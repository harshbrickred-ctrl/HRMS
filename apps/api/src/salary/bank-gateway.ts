import { createCipheriv, createDecipheriv, createHash, randomBytes, randomInt } from 'crypto';

function secretKey() {
  return createHash('sha256').update(process.env.BANK_SECRET || 'peopleos-mock-bank-key').digest();
}

export function encryptSecret(plain: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', secretKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString('base64');
}

export function decryptSecret(payload: string) {
  const buf = Buffer.from(payload, 'base64');
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const data = buf.subarray(28);
  const decipher = createDecipheriv('aes-256-gcm', secretKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
}

export function hashOtp(batchId: string, otp: string) {
  return createHash('sha256').update(`${batchId}:${otp}`).digest('hex');
}

export function confirmationCode() {
  return String(randomInt(0, 1_000_000)).padStart(6, '0');
}
