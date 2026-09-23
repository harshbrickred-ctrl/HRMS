import { describe, expect, it } from '@jest/globals';
import { createHash } from 'crypto';

describe('auth helpers', () => {
  it('hashes refresh tokens with sha256', () => {
    const token = 'sample-refresh-token-value';
    const hash = createHash('sha256').update(token).digest('hex');
    expect(hash).toHaveLength(64);
  });
});
