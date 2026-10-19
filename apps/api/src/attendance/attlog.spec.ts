import { commKeyHash, commKeyMatches, parseAttlog, parseDeviceCommandResult, punchKey, takePunch } from './attlog';

describe('eSSL ATTLOG', () => {
  it('parses tab-separated punch lines', () => {
    const parsed = parseAttlog('1001\t2026-10-15 09:00:00\t0\t1\t0\n\nbad line\n');
    expect(parsed.ok).toEqual([
      {
        pin: '1001',
        rawTimestamp: '2026-10-15 09:00:00',
        statusCode: 0,
        verifyMode: 1,
        workCode: '0',
        rawLine: '1001\t2026-10-15 09:00:00\t0\t1\t0',
      },
    ]);
    expect(parsed.bad).toEqual(['bad line']);
  });

  it('treats a repeated device line as one punch', () => {
    const key = punchKey({
      tenantId: 't1',
      serial: 'SN1',
      pin: '1001',
      rawTimestamp: '2026-10-15 09:00:00',
      statusCode: 0,
      verifyMode: 1,
    });
    const seen = new Set<string>();
    expect(takePunch(seen, key)).toBe('insert');
    expect(takePunch(seen, key)).toBe('duplicate');
    expect(punchKey({
      tenantId: 't1',
      serial: 'SN1',
      pin: '1001',
      rawTimestamp: '2026-10-15 09:00:00',
      statusCode: 0,
      verifyMode: 1,
    })).toBe(key);
  });

  it('matches a comm key only against its hash', () => {
    const hash = commKeyHash('office-key');
    expect(commKeyMatches(hash, 'office-key')).toBe(true);
    expect(commKeyMatches(hash, 'other')).toBe(false);
    expect(commKeyMatches(null, undefined)).toBe(true);
    expect(commKeyMatches(hash, undefined)).toBe(false);
  });

  it('reads a device command result', () => {
    expect(parseDeviceCommandResult('ID=12&Return=0&CMD=DATA')).toEqual({
      id: 12,
      returnCode: 0,
    });
  });
});
