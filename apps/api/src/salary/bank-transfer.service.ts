import { createHash, randomBytes } from 'crypto';
import { BadRequestException, ForbiddenException, Injectable, NotFoundException, OnModuleInit, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import type { AuthUser } from '../auth/current-user.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { confirmationCode, decryptSecret, encryptSecret, hashOtp } from './bank-gateway';
import type { AuthoriseTransferDto } from './dto/salary.dto';
import {
  RazorpayXGateway,
  beneficiaryName,
  interpretPayout,
  razorpayMissingEnv,
  razorpayWebhookValid,
  salaryNarration,
  type RazorpayConfig,
  type RazorpayXClient,
} from './razorpay-x';

const AUTHORISER_ROLES = ['FIN', 'ACC', 'PAY', 'SYS', 'SECURITY_ADMIN'];
const OPEN_BATCH = ['pending', 'initiated', 'in_progress'];
const BLOCKING_TX = ['pending', 'initiated', 'in_progress', 'success'];

@Injectable()
export class BankTransferService implements OnModuleInit {
  constructor(
    private readonly prisma: PrismaService,
    private readonly razorpay: RazorpayXGateway,
  ) {}

  async onModuleInit() {
    await this.ensureTables();
  }

  async overview(actor: AuthUser, month: string) {
    const connection = await this.prisma.bankConnection.findUnique({ where: { tenantId: actor.tenantId } });
    const batches = await this.prisma.salaryTransferBatch.findMany({
      where: { tenantId: actor.tenantId, month },
      include: { transactions: true },
      orderBy: { createdAt: 'desc' },
    });
    const users = await this.userEmails(actor.tenantId, batches.flatMap((batch) => [batch.createdById, batch.authorisedById ?? '']));
    const linked = connection?.mode === 'razorpay' ? connection : null;
    return {
      mode: 'razorpay',
      configured: Boolean(this.razorpay.config()),
      missing: razorpayMissingEnv(),
      connection: linked
        ? {
            bankCode: 'razorpay',
            corporateId: 'RazorpayX',
            accountLast4: linked.accountLast4,
            mode: 'razorpay',
            status: linked.status,
            live: linked.status === 'live',
          }
        : null,
      batches: await Promise.all(batches.map((batch) => this.present(batch, actor, users))),
    };
  }

  async register(actor: AuthUser) {
    const config = this.requireConfig();
    const live = config.keyId.startsWith('rzp_live_');
    const saved = await this.prisma.bankConnection.upsert({
      where: { tenantId: actor.tenantId },
      create: {
        tenantId: actor.tenantId,
        bankCode: 'razorpay',
        corporateId: 'RazorpayX',
        corporateUserCipher: encryptSecret('razorpayx'),
        accountCipher: encryptSecret(config.accountNumber),
        accountLast4: config.accountNumber.slice(-4),
        mode: 'razorpay',
        status: live ? 'live' : 'test',
      },
      update: {
        bankCode: 'razorpay',
        corporateId: 'RazorpayX',
        corporateUserCipher: encryptSecret('razorpayx'),
        accountCipher: encryptSecret(config.accountNumber),
        accountLast4: config.accountNumber.slice(-4),
        mode: 'razorpay',
        status: live ? 'live' : 'test',
      },
    });
    await this.log(actor.tenantId, '', 'register', `RazorpayX ${saved.status} connected. Account ending ${saved.accountLast4}.`);
    return {
      bankCode: 'razorpay',
      corporateId: 'RazorpayX',
      accountLast4: saved.accountLast4,
      mode: 'razorpay',
      status: saved.status,
      live,
    };
  }

  async createBatch(actor: AuthUser, month: string, employeeIds: string[]) {
    const connection = await this.prisma.bankConnection.findUnique({ where: { tenantId: actor.tenantId } });
    if (!connection || connection.mode !== 'razorpay') {
      throw new BadRequestException('Connect RazorpayX before creating a transfer.');
    }
    this.requireConfig();
    const payroll = await this.prisma.payrollMonth.findUnique({
      where: { tenantId_month: { tenantId: actor.tenantId, month } },
    });
    if (!payroll?.approved) throw new BadRequestException('HR Head has to approve this payroll first.');
    const open = await this.prisma.salaryTransferBatch.findFirst({
      where: { tenantId: actor.tenantId, month, status: { in: OPEN_BATCH } },
    });
    if (open) throw new BadRequestException(`${open.reference} is still open. Finish it before creating another batch.`);

    const chosen = [...new Set(employeeIds)];
    const lines = await this.prisma.salaryLine.findMany({
      where: { tenantId: actor.tenantId, month, submittedToFinance: true, employeeId: { in: chosen } },
      include: { employee: true },
      orderBy: { employee: { employeeCode: 'asc' } },
    });
    if (lines.length !== chosen.length) {
      throw new BadRequestException('One or more selected employees are not in this payroll.');
    }

    const history = await this.prisma.salaryTransferTransaction.findMany({
      where: { tenantId: actor.tenantId, month },
      select: { employeeId: true, status: true },
    });
    const busy = new Set(history.filter((row) => BLOCKING_TX.includes(row.status)).map((row) => row.employeeId));
    const attemptOf = new Map<string, number>();
    for (const row of history) {
      attemptOf.set(row.employeeId, (attemptOf.get(row.employeeId) ?? 0) + 1);
    }

    const drafted = lines.map((line) => {
      const ready = bankReady(line.employee.ifscCode, line.employee.bankAccountNumber);
      let skipReason = '';
      if (line.paymentStatus === 'paid' || busy.has(line.employeeId)) skipReason = 'Already paid or already in a transfer.';
      else if (!ready) skipReason = 'Bank account or IFSC is missing.';
      return { line, skipReason };
    });
    const payable = drafted.filter((item) => !item.skipReason);
    const blocked = drafted.filter((item) => item.skipReason);
    if (blocked.length) {
      const detail = blocked
        .map((item) => `${item.line.employee.employeeCode} (${item.skipReason.replace(/\.$/, '')})`)
        .join(', ');
      throw new BadRequestException(`These employees cannot be paid by direct transfer: ${detail}.`);
    }
    if (!payable.length) throw new BadRequestException('Select at least one employee who is ready for a direct transfer.');

    const count = await this.prisma.salaryTransferBatch.count({ where: { tenantId: actor.tenantId } });
    const reference = `PAY${String(count + 1).padStart(3, '0')}`;
    const batch = await this.prisma.salaryTransferBatch.create({
      data: {
        tenantId: actor.tenantId,
        month,
        reference,
        status: 'pending',
        createdById: actor.userId,
        willPayCount: payable.length,
        skippedCount: drafted.length - payable.length,
        totalAmount: payable.reduce((sum, item) => sum + item.line.netPay, 0),
        transactions: {
          create: drafted.map((item) => ({
            tenantId: actor.tenantId,
            employeeId: item.line.employeeId,
            month,
            amount: item.line.netPay,
            status: item.skipReason ? 'skipped' : 'pending',
            skipReason: item.skipReason,
            idempotencyKey: `${actor.tenantId}:${month}:${item.line.employeeId}:${(attemptOf.get(item.line.employeeId) ?? 0) + 1}`,
          })),
        },
      },
      include: { transactions: true },
    });
    await this.prisma.salaryLine.updateMany({
      where: { tenantId: actor.tenantId, month, employeeId: { in: payable.map((item) => item.line.employeeId) } },
      data: { paymentStatus: 'direct', status: 'payout' },
    });
    await this.log(actor.tenantId, batch.id, 'batch', `${reference} created. ${batch.willPayCount} to pay, ${batch.skippedCount} skipped.`);
    const users = await this.userEmails(actor.tenantId, [actor.userId]);
    return await this.present(await this.load(actor.tenantId, batch.id), actor, users);
  }

  async cancel(actor: AuthUser, batchId: string) {
    const batch = await this.load(actor.tenantId, batchId);
    if (batch.createdById !== actor.userId) throw new ForbiddenException('Only the maker can cancel this transfer.');
    if (batch.status !== 'pending') throw new BadRequestException('Only a batch that has not been initiated can be cancelled.');
    await this.release(actor.tenantId, batch.month, payableIds(batch), 'cancelled');
    await this.prisma.salaryTransferBatch.update({
      where: { id: batch.id },
      data: { status: 'rejected', otpHash: '', otpExpiresAt: null },
    });
    await this.prisma.salaryTransferTransaction.updateMany({
      where: { batchId: batch.id, status: 'pending' },
      data: { status: 'failed', skipReason: 'Cancelled before initiation.' },
    });
    await this.log(actor.tenantId, batch.id, 'cancel', `${batch.reference} cancelled before initiation.`);
    return await this.present(await this.load(actor.tenantId, batch.id), actor, await this.userEmails(actor.tenantId, [batch.createdById]));
  }

  async issueOtp(actor: AuthUser, batchId: string) {
    const batch = await this.load(actor.tenantId, batchId);
    if (batch.createdById !== actor.userId) throw new ForbiddenException('Only the maker can initiate this transfer.');
    if (batch.status !== 'pending') throw new BadRequestException('This batch is no longer waiting to be initiated.');
    const otp = confirmationCode();
    const expires = new Date(Date.now() + 5 * 60 * 1000);
    await this.prisma.salaryTransferBatch.update({
      where: { id: batch.id },
      data: { otpHash: hashOtp(batch.id, otp), otpExpiresAt: expires },
    });
    return { batchId: batch.id, confirmationCode: otp, expiresAt: expires.toISOString() };
  }

  async verifyOtp(actor: AuthUser, batchId: string, otp: string) {
    const batch = await this.load(actor.tenantId, batchId);
    if (batch.createdById !== actor.userId) throw new ForbiddenException('Only the maker can initiate this transfer.');
    if (batch.status !== 'pending') throw new BadRequestException('This batch is no longer waiting to be initiated.');
    if (!batch.otpHash || !batch.otpExpiresAt || batch.otpExpiresAt.getTime() < Date.now()) {
      throw new BadRequestException('Ask for a new OTP. This one has expired.');
    }
    if (batch.otpHash !== hashOtp(batch.id, otp)) throw new BadRequestException('OTP does not match.');
    await this.prisma.salaryTransferBatch.update({
      where: { id: batch.id },
      data: {
        status: 'initiated',
        initiatedAt: new Date(),
        otpHash: '',
        otpExpiresAt: null,
      },
    });
    await this.prisma.salaryTransferTransaction.updateMany({
      where: { batchId: batch.id, status: 'pending' },
      data: { status: 'initiated' },
    });
    await this.log(actor.tenantId, batch.id, 'initiate', `${batch.reference} confirmed. RazorpayX has not been charged.`);
    return await this.present(await this.load(actor.tenantId, batch.id), actor, await this.userEmails(actor.tenantId, [batch.createdById]));
  }

  async authorise(actor: AuthUser, batchId: string, dto: AuthoriseTransferDto) {
    if (!actor.roles.some((role) => AUTHORISER_ROLES.includes(role))) {
      throw new ForbiddenException('A finance authoriser has to approve this transfer.');
    }
    const batch = await this.load(actor.tenantId, batchId);
    if (batch.status !== 'initiated') throw new BadRequestException('Initiate the transfer before authorising it.');
    if (dto.decision === 'reject') {
      if (batch.transactions.some((tx) => tx.providerPayoutId)) {
        throw new BadRequestException('RazorpayX already has payouts for this batch. Refresh the status instead of rejecting it.');
      }
      await this.release(actor.tenantId, batch.month, payableIds(batch), 'rejected');
      await this.prisma.salaryTransferBatch.update({
        where: { id: batch.id },
        data: { status: 'rejected', authorisedById: actor.userId, authorisedAt: new Date() },
      });
      await this.prisma.salaryTransferTransaction.updateMany({
        where: { batchId: batch.id, status: { in: ['pending', 'initiated'] } },
        data: { status: 'failed', skipReason: 'Rejected by the authoriser.' },
      });
      await this.log(actor.tenantId, batch.id, 'reject', `${batch.reference} rejected. Employees can be paid again.`);
    } else {
      const config = await this.sourceAccount(batch.tenantId, this.requireConfig());
      const client = this.razorpay.client(config);
      const rows = await this.payoutRows(batch);
      let sent = 0;
      const failedIds: string[] = [];
      for (const row of rows) {
        if (row.tx.status === 'skipped' || row.tx.status === 'success') continue;
        if (row.tx.providerPayoutId) {
          sent += 1;
          continue;
        }
        try {
          const fundAccountId = await this.fundAccount(client, batch.tenantId, row);
          const payout = await client.createSalaryPayout({
            fundAccountId,
            amountRupees: row.tx.amount,
            idempotencyKey: payoutIdempotency(row.tx.idempotencyKey),
            referenceId: `${row.employeeCode}-${batch.month}`,
            narration: salaryNarration(batch.month),
          });
          const outcome = interpretPayout(payout);
          if (outcome.kind === 'paid') {
            await this.prisma.salaryTransferTransaction.update({
              where: { id: row.tx.id },
              data: { providerPayoutId: payout.id, status: 'success', utr: outcome.utr, skipReason: '' },
            });
            await this.prisma.salaryLine.updateMany({
              where: { tenantId: batch.tenantId, month: batch.month, employeeId: row.tx.employeeId },
              data: { paymentStatus: 'paid', utr: outcome.utr, status: 'paid', payoutGenerated: true },
            });
          } else if (outcome.kind === 'failed') {
            await this.prisma.salaryTransferTransaction.update({
              where: { id: row.tx.id },
              data: { providerPayoutId: payout.id, status: 'failed', utr: '', skipReason: outcome.reason },
            });
            failedIds.push(row.tx.employeeId);
          } else {
            await this.prisma.salaryTransferTransaction.update({
              where: { id: row.tx.id },
              data: { providerPayoutId: payout.id, status: 'in_progress', skipReason: outcome.note },
            });
          }
          sent += 1;
        } catch (error) {
          const reason = error instanceof Error ? error.message : 'RazorpayX rejected this payout.';
          await this.prisma.salaryTransferTransaction.update({
            where: { id: row.tx.id },
            data: { status: 'failed', skipReason: reason, utr: '' },
          });
          failedIds.push(row.tx.employeeId);
        }
      }
      await this.release(batch.tenantId, batch.month, failedIds, 'failed');
      const fresh = await this.load(batch.tenantId, batch.id);
      const payable = fresh.transactions.filter((tx) => tx.status !== 'skipped');
      const open = payable.filter((tx) => tx.status !== 'success' && tx.status !== 'failed');
      const paid = payable.filter((tx) => tx.status === 'success');
      const failed = payable.filter((tx) => tx.status === 'failed');
      const status = open.length ? 'in_progress' : paid.length && failed.length ? 'partial' : paid.length ? 'success' : 'failed';
      await this.prisma.salaryTransferBatch.update({
        where: { id: batch.id },
        data: {
          status,
          authorisedById: actor.userId,
          authorisedAt: new Date(),
          providerRef: 'razorpayx',
        },
      });
      await this.log(
        actor.tenantId,
        batch.id,
        'authorise',
        sent > 0
          ? `${batch.reference} sent to RazorpayX. ${paid.length} already have a UTR. The rest stay unpaid until RazorpayX returns one.`
          : `${batch.reference} was not accepted by RazorpayX.`,
      );
    }
    return await this.present(
      await this.load(actor.tenantId, batch.id),
      actor,
      await this.userEmails(actor.tenantId, [batch.createdById, actor.userId]),
    );
  }

  async sync(actor: AuthUser, batchId: string) {
    const batch = await this.load(actor.tenantId, batchId);
    if (!['in_progress', 'partial', 'success'].includes(batch.status)) {
      throw new BadRequestException('Authorise the transfer before reading the RazorpayX status.');
    }
    const config = await this.sourceAccount(batch.tenantId, this.requireConfig());
    const client = this.razorpay.client(config);
    for (const tx of batch.transactions) {
      if (tx.status === 'skipped') continue;
      if (!tx.providerPayoutId) {
        if (tx.status !== 'failed') {
          await this.applyPayoutOutcome(tx, { kind: 'failed', reason: 'RazorpayX payout was not created.' });
        }
        continue;
      }
      const payout = await client.fetchPayout(tx.providerPayoutId);
      await this.applyPayoutOutcome(tx, interpretPayout(payout));
    }
    const fresh = await this.recomputeBatch(actor.tenantId, batch.id);
    await this.log(
      actor.tenantId,
      batch.id,
      'sync',
      `${batch.reference}: ${fresh.paid} paid, ${fresh.failed} failed, ${fresh.open} still with RazorpayX.`,
    );
    return await this.present(
      await this.load(actor.tenantId, batch.id),
      actor,
      await this.userEmails(actor.tenantId, [batch.createdById, batch.authorisedById ?? '']),
    );
  }

  async handleWebhook(rawBody: Buffer, signature: string) {
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET?.trim() ?? '';
    if (!secret) throw new ServiceUnavailableException('Razorpay webhook secret is not configured.');
    if (!razorpayWebhookValid(rawBody, signature, secret)) {
      throw new UnauthorizedException('Invalid Razorpay signature.');
    }
    let event: { payload?: { payout?: { entity?: { id?: string; status?: string; utr?: string | null; status_details?: { description?: string } | null } } } };
    try {
      event = JSON.parse(rawBody.toString('utf8')) as typeof event;
    } catch {
      throw new BadRequestException('Invalid webhook body.');
    }
    const payout = event.payload?.payout?.entity;
    if (!payout?.id) return { received: true };
    const tx = await this.prisma.salaryTransferTransaction.findFirst({ where: { providerPayoutId: payout.id } });
    if (!tx) return { received: true };
    await this.applyPayoutOutcome(tx, interpretPayout(payout));
    await this.recomputeBatch(tx.tenantId, tx.batchId);
    await this.log(tx.tenantId, tx.batchId, 'webhook', `RazorpayX payout ${payout.id.slice(0, 8)} is ${payout.status ?? 'updated'}.`);
    return { received: true };
  }

  private async applyPayoutOutcome(
    tx: { id: string; tenantId: string; month: string; employeeId: string },
    outcome: ReturnType<typeof interpretPayout>,
  ) {
    if (outcome.kind === 'paid') {
      await this.prisma.salaryTransferTransaction.update({
        where: { id: tx.id },
        data: { status: 'success', utr: outcome.utr, skipReason: '' },
      });
      await this.prisma.salaryLine.updateMany({
        where: { tenantId: tx.tenantId, month: tx.month, employeeId: tx.employeeId },
        data: { paymentStatus: 'paid', utr: outcome.utr, status: 'paid', payoutGenerated: true },
      });
      return;
    }
    if (outcome.kind === 'failed') {
      await this.prisma.salaryTransferTransaction.update({
        where: { id: tx.id },
        data: { status: 'failed', utr: '', skipReason: outcome.reason },
      });
      await this.prisma.salaryLine.updateMany({
        where: { tenantId: tx.tenantId, month: tx.month, employeeId: tx.employeeId, paymentStatus: 'paid' },
        data: { paymentStatus: 'pending', status: 'submitted', payoutGenerated: false, utr: '' },
      });
      await this.release(tx.tenantId, tx.month, [tx.employeeId], 'failed');
      return;
    }
    await this.prisma.salaryTransferTransaction.update({
      where: { id: tx.id },
      data: { status: 'in_progress', skipReason: outcome.note },
    });
  }

  private async recomputeBatch(tenantId: string, batchId: string) {
    const fresh = await this.load(tenantId, batchId);
    const payable = fresh.transactions.filter((tx) => tx.status !== 'skipped');
    const open = payable.filter((tx) => tx.status !== 'success' && tx.status !== 'failed').length;
    const paid = payable.filter((tx) => tx.status === 'success').length;
    const failed = payable.filter((tx) => tx.status === 'failed').length;
    const status = open ? 'in_progress' : paid && failed ? 'partial' : paid ? 'success' : 'failed';
    await this.prisma.salaryTransferBatch.update({ where: { id: batchId }, data: { status } });
    return { open, paid, failed };
  }

  private requireConfig() {
    const config = this.razorpay.config();
    if (!config) {
      throw new BadRequestException(`RazorpayX is not configured. Set ${razorpayMissingEnv().join(', ')} on the API server.`);
    }
    return config;
  }

  private async sourceAccount(tenantId: string, config: RazorpayConfig) {
    const connection = await this.prisma.bankConnection.findUnique({ where: { tenantId } });
    if (!connection || connection.mode !== 'razorpay') {
      throw new BadRequestException('Connect RazorpayX before sending salary.');
    }
    let saved = '';
    try {
      saved = decryptSecret(connection.accountCipher);
    } catch {
      saved = '';
    }
    if (saved !== config.accountNumber) {
      throw new BadRequestException('The RazorpayX account on the server changed. Connect RazorpayX again before sending salary.');
    }
    return config;
  }

  private async payoutRows(batch: Awaited<ReturnType<BankTransferService['load']>>) {
    const employees = await this.prisma.employee.findMany({
      where: { id: { in: batch.transactions.map((tx) => tx.employeeId) } },
    });
    const byId = new Map(employees.map((employee) => [employee.id, employee]));
    return batch.transactions.map((tx) => {
      const employee = byId.get(tx.employeeId);
      return {
        tx,
        employeeId: tx.employeeId,
        employeeCode: employee?.employeeCode ?? tx.employeeId,
        name: beneficiaryName(employee?.firstName ?? '', employee?.lastName ?? ''),
        account: (employee?.bankAccountNumber ?? '').replace(/\s/g, ''),
        ifsc: (employee?.ifscCode ?? '').trim().toUpperCase(),
      };
    });
  }

  private async fundAccount(
    client: RazorpayXClient,
    tenantId: string,
    row: { employeeId: string; employeeCode: string; name: string; account: string; ifsc: string },
  ) {
    const fingerprint = createHash('sha256').update(`${row.account}|${row.ifsc}`).digest('hex');
    const existing = await this.prisma.$queryRaw<Array<{ fundAccountId: string }>>`
      SELECT "fundAccountId" FROM "RazorpayFundAccount"
      WHERE "tenantId" = ${tenantId} AND "employeeId" = ${row.employeeId} AND "fingerprint" = ${fingerprint}
      LIMIT 1
    `;
    if (existing[0]?.fundAccountId) return existing[0].fundAccountId;
    const contact = await client.createContact({
      name: row.name,
      referenceId: row.employeeId,
      employeeCode: row.employeeCode,
    });
    const fund = await client.createFundAccount({
      contactId: contact.id,
      name: row.name,
      ifsc: row.ifsc,
      accountNumber: row.account,
    });
    const id = randomBytes(12).toString('hex');
    try {
      await this.prisma.$executeRaw`
        INSERT INTO "RazorpayFundAccount" ("id", "tenantId", "employeeId", "fingerprint", "contactId", "fundAccountId", "createdAt")
        VALUES (${id}, ${tenantId}, ${row.employeeId}, ${fingerprint}, ${contact.id}, ${fund.id}, NOW())
      `;
    } catch {
      const again = await this.prisma.$queryRaw<Array<{ fundAccountId: string }>>`
        SELECT "fundAccountId" FROM "RazorpayFundAccount"
        WHERE "tenantId" = ${tenantId} AND "employeeId" = ${row.employeeId} AND "fingerprint" = ${fingerprint}
        LIMIT 1
      `;
      if (again[0]?.fundAccountId) return again[0].fundAccountId;
      throw new BadRequestException('Could not save the RazorpayX fund account.');
    }
    return fund.id;
  }

  private async release(tenantId: string, month: string, employeeIds: string[], _reason: string) {
    if (!employeeIds.length) return;
    await this.prisma.salaryLine.updateMany({
      where: { tenantId, month, employeeId: { in: employeeIds }, paymentStatus: 'direct' },
      data: { paymentStatus: 'pending', status: 'submitted', payoutGenerated: false, utr: '' },
    });
  }

  private async load(tenantId: string, batchId: string) {
    const batch = await this.prisma.salaryTransferBatch.findFirst({
      where: { id: batchId, tenantId },
      include: { transactions: true },
    });
    if (!batch) throw new NotFoundException('Transfer batch not found.');
    return batch;
  }

  private async present(
    batch: Awaited<ReturnType<BankTransferService['load']>>,
    actor: AuthUser,
    emails: Map<string, string>,
  ) {
    const employees = await this.prisma.employee.findMany({
      where: { id: { in: batch.transactions.map((tx) => tx.employeeId) } },
      select: { id: true, employeeCode: true, firstName: true, lastName: true },
    });
    const names = new Map(
      employees.map((employee) => [
        employee.id,
        { employeeCode: employee.employeeCode, name: `${employee.firstName} ${employee.lastName}`.trim() },
      ]),
    );
    return {
      id: batch.id,
      reference: batch.reference,
      month: batch.month,
      status: batch.status,
      willPayCount: batch.willPayCount,
      skippedCount: batch.skippedCount,
      totalAmount: batch.totalAmount,
      createdById: batch.createdById,
      createdByEmail: emails.get(batch.createdById) ?? '',
      authorisedByEmail: batch.authorisedById ? emails.get(batch.authorisedById) ?? '' : '',
      canAuthorise: batch.status === 'initiated' && actor.roles.some((role) => AUTHORISER_ROLES.includes(role)),
      transactions: batch.transactions.map((tx) => ({
        employeeId: tx.employeeId,
        employeeCode: names.get(tx.employeeId)?.employeeCode ?? '',
        name: names.get(tx.employeeId)?.name ?? '',
        amount: tx.amount,
        status: tx.status,
        skipReason: tx.skipReason,
        utr: tx.utr,
      })),
    };
  }

  private async userEmails(tenantId: string, ids: string[]) {
    const users = await this.prisma.user.findMany({
      where: { tenantId, id: { in: ids.filter(Boolean) } },
      select: { id: true, email: true },
    });
    return new Map(users.map((user) => [user.id, user.email]));
  }

  private async log(tenantId: string, batchId: string, action: string, summary: string) {
    await this.prisma.bankApiLog.create({ data: { tenantId, batchId, action, summary } });
  }

  private async ensureTables() {
    await this.prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "BankConnection" (
        "id" TEXT NOT NULL,
        "tenantId" TEXT NOT NULL,
        "bankCode" TEXT NOT NULL,
        "corporateId" TEXT NOT NULL,
        "corporateUserCipher" TEXT NOT NULL,
        "accountCipher" TEXT NOT NULL,
        "accountLast4" TEXT NOT NULL,
        "mode" TEXT NOT NULL DEFAULT 'mock',
        "status" TEXT NOT NULL DEFAULT 'mock_connected',
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "BankConnection_pkey" PRIMARY KEY ("id")
      )
    `);
    await this.prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "BankConnection_tenantId_key" ON "BankConnection"("tenantId")`);
    await this.prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "SalaryTransferBatch" (
        "id" TEXT NOT NULL,
        "tenantId" TEXT NOT NULL,
        "month" TEXT NOT NULL,
        "reference" TEXT NOT NULL,
        "status" TEXT NOT NULL DEFAULT 'pending',
        "createdById" TEXT NOT NULL,
        "initiatedAt" TIMESTAMP(3),
        "authorisedById" TEXT,
        "authorisedAt" TIMESTAMP(3),
        "providerRef" TEXT NOT NULL DEFAULT '',
        "otpHash" TEXT NOT NULL DEFAULT '',
        "otpExpiresAt" TIMESTAMP(3),
        "willPayCount" INTEGER NOT NULL,
        "skippedCount" INTEGER NOT NULL,
        "totalAmount" INTEGER NOT NULL,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "SalaryTransferBatch_pkey" PRIMARY KEY ("id")
      )
    `);
    await this.prisma.$executeRawUnsafe(
      `CREATE UNIQUE INDEX IF NOT EXISTS "SalaryTransferBatch_tenantId_reference_key" ON "SalaryTransferBatch"("tenantId", "reference")`,
    );
    await this.prisma.$executeRawUnsafe(
      `CREATE INDEX IF NOT EXISTS "SalaryTransferBatch_tenantId_month_idx" ON "SalaryTransferBatch"("tenantId", "month")`,
    );
    await this.prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "SalaryTransferTransaction" (
        "id" TEXT NOT NULL,
        "tenantId" TEXT NOT NULL,
        "batchId" TEXT NOT NULL,
        "employeeId" TEXT NOT NULL,
        "month" TEXT NOT NULL,
        "amount" INTEGER NOT NULL,
        "status" TEXT NOT NULL,
        "skipReason" TEXT NOT NULL DEFAULT '',
        "utr" TEXT NOT NULL DEFAULT '',
        "providerPayoutId" TEXT NOT NULL DEFAULT '',
        "idempotencyKey" TEXT NOT NULL,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "SalaryTransferTransaction_pkey" PRIMARY KEY ("id")
      )
    `);
    await this.prisma.$executeRawUnsafe(
      `CREATE UNIQUE INDEX IF NOT EXISTS "SalaryTransferTransaction_idempotencyKey_key" ON "SalaryTransferTransaction"("idempotencyKey")`,
    );
    await this.prisma.$executeRawUnsafe(
      `ALTER TABLE "SalaryTransferTransaction" ADD COLUMN IF NOT EXISTS "providerPayoutId" TEXT NOT NULL DEFAULT ''`,
    );
    await this.prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "RazorpayFundAccount" (
        "id" TEXT NOT NULL,
        "tenantId" TEXT NOT NULL,
        "employeeId" TEXT NOT NULL,
        "fingerprint" TEXT NOT NULL,
        "contactId" TEXT NOT NULL,
        "fundAccountId" TEXT NOT NULL,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "RazorpayFundAccount_pkey" PRIMARY KEY ("id")
      )
    `);
    await this.prisma.$executeRawUnsafe(
      `CREATE UNIQUE INDEX IF NOT EXISTS "RazorpayFundAccount_lookup" ON "RazorpayFundAccount"("tenantId", "employeeId", "fingerprint")`,
    );
    await this.prisma.$executeRawUnsafe(
      `CREATE INDEX IF NOT EXISTS "SalaryTransferTransaction_tenantId_month_idx" ON "SalaryTransferTransaction"("tenantId", "month")`,
    );
    await this.prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "BankApiLog" (
        "id" TEXT NOT NULL,
        "tenantId" TEXT NOT NULL,
        "batchId" TEXT NOT NULL DEFAULT '',
        "action" TEXT NOT NULL,
        "summary" TEXT NOT NULL,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "BankApiLog_pkey" PRIMARY KEY ("id")
      )
    `);
    await this.prisma.$executeRawUnsafe(
      `CREATE INDEX IF NOT EXISTS "BankApiLog_tenantId_createdAt_idx" ON "BankApiLog"("tenantId", "createdAt")`,
    );
    await this.addForeignKey(
      `ALTER TABLE "BankConnection" ADD CONSTRAINT "BankConnection_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE`,
    );
    await this.addForeignKey(
      `ALTER TABLE "SalaryTransferBatch" ADD CONSTRAINT "SalaryTransferBatch_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE`,
    );
    await this.addForeignKey(
      `ALTER TABLE "SalaryTransferTransaction" ADD CONSTRAINT "SalaryTransferTransaction_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "SalaryTransferBatch"("id") ON DELETE CASCADE`,
    );
    await this.addForeignKey(
      `ALTER TABLE "BankApiLog" ADD CONSTRAINT "BankApiLog_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE`,
    );
  }

  private async addForeignKey(sql: string) {
    try {
      await this.prisma.$executeRawUnsafe(sql);
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      if (/already exists/i.test(message)) return;
      throw error;
    }
  }
}

function payoutIdempotency(key: string) {
  return createHash('sha256').update(key).digest('hex').slice(0, 32);
}

function bankReady(ifsc: string, account: string) {
  return /^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifsc.trim().toUpperCase()) && /^\d{9,18}$/.test(account.replace(/\s/g, ''));
}

function payableIds(batch: { transactions: Array<{ employeeId: string; status: string }> }) {
  return batch.transactions.filter((tx) => tx.status !== 'skipped').map((tx) => tx.employeeId);
}
