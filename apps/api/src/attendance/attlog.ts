import { createHash, timingSafeEqual } from 'crypto';

export type AttlogLine = {
  pin: string;
  rawTimestamp: string;
  statusCode: number;
  verifyMode: number;
  workCode: string;
  rawLine: string;
};

const STAMP = /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}$/;

export function parseAttlog(body: string) {
  const ok: AttlogLine[] = [];
  const bad: string[] = [];
  for (const line of body.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const cols = trimmed.split('\t');
    const pin = cols[0]?.trim() ?? '';
    const rawTimestamp = (cols[1] ?? '').trim().replace('T', ' ');
    if (cols.length < 2 || !pin || !STAMP.test(cols[1]?.trim() ?? '')) {
      bad.push(trimmed);
      continue;
    }
    const statusCode = Number(cols[2] ?? 0);
    const verifyMode = Number(cols[3] ?? 0);
    ok.push({
      pin,
      rawTimestamp,
      statusCode: Number.isFinite(statusCode) ? statusCode : 0,
      verifyMode: Number.isFinite(verifyMode) ? verifyMode : 0,
      workCode: cols[4] ?? '',
      rawLine: trimmed,
    });
  }
  return { ok, bad };
}

export function punchKey(parts: {
  tenantId: string;
  serial: string;
  pin: string;
  rawTimestamp: string;
  statusCode: number;
  verifyMode: number;
}) {
  return createHash('sha256')
    .update(
      [
        parts.tenantId,
        parts.serial,
        parts.pin,
        parts.rawTimestamp,
        parts.statusCode,
        parts.verifyMode,
      ].join('|'),
    )
    .digest('hex');
}

export function takePunch(seen: Set<string>, key: string) {
  if (seen.has(key)) return 'duplicate' as const;
  seen.add(key);
  return 'insert' as const;
}

export function commKeyHash(key: string) {
  return createHash('sha256').update(key).digest('hex');
}

export function commKeyMatches(hash: string | null, presented: string | undefined) {
  if (!hash) return true;
  if (!presented) return false;
  const got = Buffer.from(commKeyHash(presented));
  const expected = Buffer.from(hash);
  if (got.length !== expected.length) return false;
  return timingSafeEqual(got, expected);
}

export function parseDeviceCommandResult(body: string) {
  const id = Number(body.match(/(?:^|[&\s])ID=(\d+)/i)?.[1] ?? '');
  const returnCode = Number(body.match(/Return=(-?\d+)/i)?.[1] ?? '');
  return {
    id: Number.isFinite(id) ? id : null,
    returnCode: Number.isFinite(returnCode) ? returnCode : null,
  };
}
