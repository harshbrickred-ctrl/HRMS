import {
  accessStatus,
  audienceMatches,
  canInvite,
  canMoveApplication,
  canMoveReferral,
  canMoveRequest,
  directoryCard,
  formatTenure,
  hashToken,
  matchesDirectory,
  newToken,
  parseVisibility,
  passwordProblem,
  portalAllowed,
  readAudience,
  readVisibility,
  rewardProblem,
  tenureMonths,
} from './alumni-rules';

const d = (value: string) => new Date(`${value}T00:00:00.000Z`);

describe('alumni rules', () => {
  describe('tenure', () => {
    it('counts whole months with both days included', () => {
      expect(tenureMonths(d('2022-01-10'), d('2022-02-09'))).toBe(1);
      expect(tenureMonths(d('2022-01-10'), d('2022-02-08'))).toBe(0);
      expect(tenureMonths(d('2020-06-01'), d('2026-05-31'))).toBe(72);
      expect(tenureMonths(d('2022-01-31'), d('2022-02-28'))).toBe(1);
    });

    it('rejects a last working day before joining', () => {
      expect(() => tenureMonths(d('2024-05-01'), d('2024-04-30'))).toThrow();
    });

    it('formats tenure for people', () => {
      expect(formatTenure(0)).toBe('Less than a month');
      expect(formatTenure(1)).toBe('1 month');
      expect(formatTenure(12)).toBe('1 year');
      expect(formatTenure(27)).toBe('2 years 3 months');
    });
  });

  describe('eligibility and access', () => {
    it('invites only eligible alumni', () => {
      expect(canInvite('eligible')).toBe(true);
      expect(canInvite('not_eligible')).toBe(false);
      expect(canInvite('do_not_contact')).toBe(false);
    });

    it('allows the portal only for an active login that is still eligible', () => {
      expect(portalAllowed('active', 'eligible')).toBe(true);
      expect(portalAllowed('active', 'do_not_contact')).toBe(false);
      expect(portalAllowed('revoked', 'eligible')).toBe(false);
      expect(portalAllowed('withdrawn', 'eligible')).toBe(false);
    });

    it('derives the HR access status', () => {
      const now = d('2026-11-10');
      const open = {
        acceptedAt: null,
        revokedAt: null,
        expiresAt: d('2026-11-15'),
      };
      expect(accessStatus(null, null, now)).toBe('not_invited');
      expect(accessStatus(null, open, now)).toBe('invited');
      expect(
        accessStatus(null, { ...open, expiresAt: d('2026-11-01') }, now),
      ).toBe('invite_expired');
      expect(
        accessStatus({ status: 'active' }, { ...open, acceptedAt: now }, now),
      ).toBe('registered');
      expect(
        accessStatus({ status: 'revoked' }, { ...open, revokedAt: now }, now),
      ).toBe('revoked');
      expect(accessStatus({ status: 'revoked' }, open, now)).toBe('invited');
    });
  });

  describe('tokens and passwords', () => {
    it('creates long random tokens and stores only a hash', () => {
      const a = newToken();
      const b = newToken();
      expect(a).not.toBe(b);
      expect(a.length).toBeGreaterThanOrEqual(40);
      expect(hashToken(a)).toMatch(/^[0-9a-f]{64}$/);
      expect(hashToken(a)).toBe(hashToken(a));
    });

    it('needs 8 characters with a letter and a number', () => {
      expect(passwordProblem('short1')).toMatch(/8 characters/);
      expect(passwordProblem('onlyletters')).toMatch(/letter and one number/);
      expect(passwordProblem('12345678')).toMatch(/letter and one number/);
      expect(passwordProblem('alumni2026')).toBeNull();
    });
  });

  describe('directory visibility', () => {
    const person = {
      id: 'a1',
      fullName: 'Asha Rao',
      departmentName: 'Engineering',
      joiningDate: d('2019-04-01'),
      lastWorkingDay: d('2025-09-30'),
      profile: {
        currentEmployer: 'Acme',
        currentDesignation: 'Lead',
        industry: 'Software',
        location: 'Pune',
        skills: ['React'],
        linkedinUrl: 'https://www.linkedin.com/in/asha',
        photoPath: 'p.png',
        phone: '+91 90000 00000',
        contactEmail: 'asha@example.com',
        visibility: { location: false },
      },
    };

    it('keeps contact details private by default and honours switches', () => {
      const card = directoryCard(person);
      expect(card.currentEmployer).toBe('Acme');
      expect(card.phone).toBeUndefined();
      expect(card.contactEmail).toBeUndefined();
      expect(card.location).toBeUndefined();
      expect(card.batch).toBe(2019);
      expect(card.exitYear).toBe(2025);
      expect(card.hasPhoto).toBe(true);
    });

    it('never matches a filter on a hidden field', () => {
      const card = directoryCard(person);
      expect(matchesDirectory(card, { location: 'Pune' })).toBe(false);
      expect(
        matchesDirectory(card, { department: 'engineering', exitYear: 2025 }),
      ).toBe(true);
      expect(matchesDirectory(card, { q: 'react' })).toBe(true);
      expect(matchesDirectory(card, { q: 'asha@example.com' })).toBe(false);
    });

    it('reads stored visibility safely and rejects unknown fields', () => {
      expect(readVisibility({ phone: 'yes' }).phone).toBe(false);
      expect(readVisibility(null).currentEmployer).toBe(true);
      expect(parseVisibility({ phone: true })).toEqual({ phone: true });
      expect(() => parseVisibility({ salary: true })).toThrow(/Unknown/);
      expect(() => parseVisibility({ phone: 'true' })).toThrow();
    });
  });

  describe('audience groups', () => {
    const person = {
      departmentName: 'Engineering',
      locationName: 'Pune',
      joiningDate: d('2019-04-01'),
      lastWorkingDay: d('2025-09-30'),
    };

    it('treats an empty audience as everyone', () => {
      expect(audienceMatches(readAudience({}), person)).toBe(true);
      expect(audienceMatches(readAudience(null), person)).toBe(true);
    });

    it('needs every chosen group to match', () => {
      expect(
        audienceMatches(
          readAudience({ departments: ['engineering'], exitYears: [2025] }),
          person,
        ),
      ).toBe(true);
      expect(
        audienceMatches(
          readAudience({ departments: ['Engineering'], exitYears: [2024] }),
          person,
        ),
      ).toBe(false);
      expect(
        audienceMatches(readAudience({ locations: ['Delhi', 'Pune'] }), person),
      ).toBe(true);
      expect(audienceMatches(readAudience({ joinYears: [2020] }), person)).toBe(
        false,
      );
    });

    it('drops malformed audience values', () => {
      expect(
        readAudience({
          departments: ['Sales', 3, ''],
          exitYears: ['2025', 2024],
        }),
      ).toEqual({
        departments: ['Sales'],
        exitYears: [2024],
        joinYears: [],
        locations: [],
      });
    });
  });

  describe('status flows', () => {
    it('moves a document request only forward', () => {
      expect(canMoveRequest('submitted', 'approved')).toBe(true);
      expect(canMoveRequest('approved', 'issued')).toBe(true);
      expect(canMoveRequest('submitted', 'issued')).toBe(false);
      expect(canMoveRequest('rejected', 'approved')).toBe(false);
      expect(canMoveRequest('issued', 'cancelled')).toBe(false);
    });

    it('keeps rehired and final applications locked', () => {
      expect(canMoveApplication('offered', 'rehired')).toBe(true);
      expect(canMoveApplication('rehired', 'rejected')).toBe(false);
      expect(canMoveApplication('withdrawn', 'applied')).toBe(false);
    });

    it('keeps final referrals locked', () => {
      expect(canMoveReferral('screening', 'hired')).toBe(true);
      expect(canMoveReferral('hired', 'hired')).toBe(true);
      expect(canMoveReferral('hired', 'rejected')).toBe(false);
    });

    it('pays a referral reward only for a hire with amount and date', () => {
      const base = {
        status: 'hired' as const,
        rewardAmount: 25000,
        rewardPaidOn: d('2026-11-01'),
      };
      expect(rewardProblem({ ...base, rewardStatus: 'paid' })).toBeNull();
      expect(
        rewardProblem({ ...base, rewardStatus: 'paid', rewardPaidOn: null }),
      ).toMatch(/date/);
      expect(
        rewardProblem({ ...base, rewardStatus: 'pending', rewardAmount: null }),
      ).toMatch(/amount/);
      expect(
        rewardProblem({
          ...base,
          status: 'screening',
          rewardStatus: 'approved',
        }),
      ).toMatch(/hired/);
      expect(
        rewardProblem({
          ...base,
          status: 'screening',
          rewardStatus: 'not_applicable',
        }),
      ).toBeNull();
    });
  });
});
