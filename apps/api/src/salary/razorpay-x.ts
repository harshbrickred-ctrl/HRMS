import { createHmac, timingSafeEqual } from 'crypto';
import { Injectable } from '@nestjs/common';

const RAZORPAY_API = 'https://api.razorpay.com/v1';

export type RazorpayConfig = {
  keyId: string;
  keySecret: string;
  accountNumber: string;
};

export type RazorpayPayout = {
  id: string;
  status: string;
  utr?: string | null;
  status_details?: { description?: string } | null;
};

export type PayoutOutcome =
  | { kind: 'paid'; utr: string }
  | { kind: 'failed'; reason: string }
  | { kind: 'pending'; note: string };

export function razorpayMissingEnv(env: NodeJS.ProcessEnv = process.env) {
  const missing: string[] = [];
  if (!env.RAZORPAY_KEY_ID?.trim()) missing.push('RAZORPAY_KEY_ID');
  if (!env.RAZORPAY_KEY_SECRET?.trim()) missing.push('RAZORPAY_KEY_SECRET');
  if (!env.RAZORPAYX_ACCOUNT_NUMBER?.replace(/\s/g, '')) missing.push('RAZORPAYX_ACCOUNT_NUMBER');
  return missing;
}

export function razorpayWebhookValid(rawBody: Buffer, signature: string, secret: string) {
  const given = signature.trim();
  const key = secret.trim();
  if (!given || !key) return false;
  const expected = createHmac('sha256', key).update(rawBody).digest('hex');
  const left = Buffer.from(expected);
  const right = Buffer.from(given);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export function razorpayConfigFromEnv(env: NodeJS.ProcessEnv = process.env): RazorpayConfig | null {
  if (razorpayMissingEnv(env).length) return null;
  return {
    keyId: env.RAZORPAY_KEY_ID!.trim(),
    keySecret: env.RAZORPAY_KEY_SECRET!.trim(),
    accountNumber: env.RAZORPAYX_ACCOUNT_NUMBER!.replace(/\s/g, ''),
  };
}

export function payoutMode(amountRupees: number): 'IMPS' | 'NEFT' {
  return amountRupees <= 500_000 ? 'IMPS' : 'NEFT';
}

export function toPaise(amountRupees: number) {
  if (!Number.isInteger(amountRupees) || amountRupees <= 0) {
    throw new Error('Salary amount must be a positive whole rupee.');
  }
  return amountRupees * 100;
}

/** Paid only after RazorpayX says processed and returns a UTR. */
export function interpretPayout(payout: { status?: string; utr?: string | null; status_details?: { description?: string } | null }): PayoutOutcome {
  const status = payout.status ?? '';
  const utr = (payout.utr ?? '').trim();
  const detail = payout.status_details?.description?.trim() ?? '';
  if (status === 'processed' && utr) return { kind: 'paid', utr };
  if (status === 'processed') return { kind: 'pending', note: detail || 'RazorpayX processed this payout but has not returned a UTR yet.' };
  if (status === 'failed' || status === 'rejected' || status === 'cancelled' || status === 'reversed') {
    return { kind: 'failed', reason: detail || `RazorpayX marked this payout ${status}.` };
  }
  return { kind: 'pending', note: detail || `RazorpayX status: ${status || 'pending'}.` };
}

export function salaryNarration(month: string) {
  const [year, mon] = month.split('-').map(Number);
  const label = new Date(Date.UTC(year, mon - 1, 1)).toLocaleString('en-IN', {
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
  return `Salary ${label}`.slice(0, 30);
}

export function beneficiaryName(firstName: string, lastName: string) {
  const cleaned = `${firstName} ${lastName}`.replace(/[^A-Za-z ]/g, ' ').replace(/\s+/g, ' ').trim();
  if (cleaned.length >= 4) return cleaned.slice(0, 50);
  return 'Employee';
}

type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;

export class RazorpayXClient {
  constructor(
    private readonly config: RazorpayConfig,
    private readonly http: FetchLike = fetch,
  ) {}

  createContact(input: { name: string; referenceId: string; employeeCode: string }) {
    return this.request<{ id: string }>('/contacts', {
      method: 'POST',
      body: {
        name: input.name,
        type: 'employee',
        reference_id: input.referenceId.slice(0, 40),
        notes: { employeeCode: input.employeeCode },
      },
    });
  }

  createFundAccount(input: { contactId: string; name: string; ifsc: string; accountNumber: string }) {
    return this.request<{ id: string }>('/fund_accounts', {
      method: 'POST',
      body: {
        contact_id: input.contactId,
        account_type: 'bank_account',
        bank_account: {
          name: input.name,
          ifsc: input.ifsc,
          account_number: input.accountNumber,
        },
      },
    });
  }

  createSalaryPayout(input: {
    fundAccountId: string;
    amountRupees: number;
    idempotencyKey: string;
    referenceId: string;
    narration: string;
  }) {
    return this.request<RazorpayPayout>('/payouts', {
      method: 'POST',
      idempotencyKey: input.idempotencyKey.slice(0, 40),
      body: {
        account_number: this.config.accountNumber,
        fund_account_id: input.fundAccountId,
        amount: toPaise(input.amountRupees),
        currency: 'INR',
        mode: payoutMode(input.amountRupees),
        purpose: 'salary',
        queue_if_low_balance: true,
        reference_id: input.referenceId.slice(0, 40),
        narration: input.narration.slice(0, 30),
      },
    });
  }

  fetchPayout(payoutId: string) {
    return this.request<RazorpayPayout>(`/payouts/${encodeURIComponent(payoutId)}`);
  }

  private async request<T>(path: string, init?: { method?: string; body?: unknown; idempotencyKey?: string }): Promise<T> {
    const headers: Record<string, string> = {
      Authorization: `Basic ${Buffer.from(`${this.config.keyId}:${this.config.keySecret}`).toString('base64')}`,
      Accept: 'application/json',
    };
    if (init?.body) headers['Content-Type'] = 'application/json';
    if (init?.idempotencyKey) headers['X-Payout-Idempotency'] = init.idempotencyKey;
    const response = await this.http(`${RAZORPAY_API}${path}`, {
      method: init?.method ?? 'GET',
      headers,
      body: init?.body ? JSON.stringify(init.body) : undefined,
    });
    const text = await response.text();
    let data: { error?: { description?: string } } = {};
    if (text) {
      try {
        data = JSON.parse(text) as { error?: { description?: string } };
      } catch {
        data = {};
      }
    }
    if (!response.ok) {
      throw new Error(data.error?.description || `RazorpayX returned ${response.status}.`);
    }
    return data as T;
  }
}

@Injectable()
export class RazorpayXGateway {
  config() {
    return razorpayConfigFromEnv();
  }

  client(config: RazorpayConfig) {
    return new RazorpayXClient(config);
  }
}
