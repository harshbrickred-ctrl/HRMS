import { createHmac } from 'crypto';
import { RazorpayXClient, interpretPayout, payoutMode, razorpayWebhookValid, salaryNarration, toPaise } from './razorpay-x';

describe('RazorpayX salary payouts', () => {
  it('keeps a processed payout unpaid until the UTR arrives', () => {
    expect(interpretPayout({ status: 'processed', utr: '' })).toEqual({
      kind: 'pending',
      note: 'RazorpayX processed this payout but has not returned a UTR yet.',
    });
    expect(interpretPayout({ status: 'processing' })).toEqual({ kind: 'pending', note: 'RazorpayX status: processing.' });
    expect(
      interpretPayout({
        status: 'queued',
        status_details: { description: 'Payout is queued as there is insufficient balance in your account to process the payout.' },
      }),
    ).toEqual({
      kind: 'pending',
      note: 'Payout is queued as there is insufficient balance in your account to process the payout.',
    });
    expect(interpretPayout({ status: 'processed', utr: 'UTR123456789' })).toEqual({ kind: 'paid', utr: 'UTR123456789' });
    expect(interpretPayout({ status: 'failed', status_details: { description: 'Account blocked' } })).toEqual({
      kind: 'failed',
      reason: 'Account blocked',
    });
  });

  it('sends salary in paise and does not put the secret in the body', async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const http = async (url: string, init?: RequestInit) => {
      calls.push({ url, init });
      return new Response(JSON.stringify({ id: 'pout_1', status: 'processing', utr: null }), { status: 200 });
    };
    const client = new RazorpayXClient(
      { keyId: 'rzp_test_key', keySecret: 'super-secret', accountNumber: '2323230045678901' },
      http,
    );
    await client.createSalaryPayout({
      fundAccountId: 'fa_1',
      amountRupees: 48429,
      idempotencyKey: 'idem-key-1',
      referenceId: 'BR106-2026-11',
      narration: salaryNarration('2026-11'),
    });

    expect(toPaise(48429)).toBe(4842900);
    expect(payoutMode(48429)).toBe('IMPS');
    expect(payoutMode(500_001)).toBe('NEFT');
    const init = calls[0].init!;
    const body = JSON.parse(String(init.body));
    expect(calls[0].url).toBe('https://api.razorpay.com/v1/payouts');
    expect(body.amount).toBe(4842900);
    expect(body.purpose).toBe('salary');
    expect(body.currency).toBe('INR');
    expect(body.fund_account_id).toBe('fa_1');
    expect(body.account_number).toBe('2323230045678901');
    expect(body.narration).toBe('Salary Nov 2026');
    expect(JSON.stringify(body)).not.toContain('super-secret');
    expect((init.headers as Record<string, string>)['X-Payout-Idempotency']).toBe('idem-key-1');
  });

  it('accepts only a signature made with the webhook secret', () => {
    const body = Buffer.from('{"event":"payout.processed"}');
    const secret = 'webhook-secret';
    const signature = createHmac('sha256', secret).update(body).digest('hex');
    expect(razorpayWebhookValid(body, signature, secret)).toBe(true);
    expect(razorpayWebhookValid(body, signature, 'other-secret')).toBe(false);
    expect(razorpayWebhookValid(body, '', secret)).toBe(false);
  });

  it('surfaces the Razorpay error text', async () => {
    const http = async () =>
      new Response(JSON.stringify({ error: { description: 'The account number is invalid.' } }), { status: 400 });
    const client = new RazorpayXClient({ keyId: 'rzp_test_key', keySecret: 'secret', accountNumber: '1234567890' }, http);
    await expect(client.fetchPayout('pout_missing')).rejects.toThrow('The account number is invalid.');
  });
});
