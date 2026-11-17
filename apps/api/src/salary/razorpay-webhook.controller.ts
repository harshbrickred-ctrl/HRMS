import { Controller, HttpCode, Post, Req, type RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import { BankTransferService } from './bank-transfer.service';

@Controller('salary/payout/direct')
export class RazorpayWebhookController {
  constructor(private readonly transfers: BankTransferService) {}

  @Post('webhook')
  @HttpCode(200)
  webhook(@Req() req: RawBodyRequest<Request>) {
    const raw = Buffer.isBuffer(req.body) ? req.body : Buffer.from('');
    return this.transfers.handleWebhook(raw, req.header('x-razorpay-signature') ?? '');
  }
}
