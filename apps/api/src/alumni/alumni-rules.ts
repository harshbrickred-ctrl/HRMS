import type {
  AlumniApplicationStatus,
  AlumniDocumentRequestStatus,
  AlumniDocumentType,
  AlumniEligibility,
  AlumniReferralStatus,
  AlumniRewardStatus,
} from '@prisma/client';
import { createHash, randomBytes, randomInt } from 'crypto';

/** Version stamped on every consent row; bump when the terms text changes. */
export const ALUMNI_TERMS_VERSION = '2026-11';
export const INVITE_TTL_DAYS = 7;
export const MAX_FAILED_LOGINS = 5;
export const LOCKOUT_MINUTES = 15;
export const OTP_TTL_MS = 10 * 60 * 1000;
export const RESET_SESSION_TTL_MS = 15 * 60 * 1000;
export const MAX_OTP_ATTEMPTS = 5;
export const SESSION_TTL_DAYS = 7;

export const ELIGIBILITY_LABELS: Record<AlumniEligibility, string> = {
  eligible: 'Eligible',
  not_eligible: 'Not eligible',
  do_not_contact: 'Do not contact',
};

export const DOCUMENT_TYPE_LABELS: Record<AlumniDocumentType, string> = {
  experience_letter: 'Experience letter',
  relieving_letter: 'Relieving letter',
  payslip: 'Payslip',
  form16: 'Form 16',
  fnf_statement: 'Full and final settlement statement',
  pf_details: 'PF details',
  other: 'Other document',
};

export function newToken(bytes = 32) {
  return randomBytes(bytes).toString('base64url');
}

export function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

export function newOtp() {
  return String(randomInt(0, 1_000_000)).padStart(6, '0');
}

/** Letters and digits, at least 8 characters. */
export function passwordProblem(password: string) {
  if (password.length < 8) return 'Password must be at least 8 characters.';
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    return 'Password must contain at least one letter and one number.';
  }
  return null;
}

/** Whole months from the joining date to the last working day (both inclusive). */
export function tenureMonths(joining: Date, lastWorkingDay: Date) {
  if (lastWorkingDay < joining) {
    throw new Error('The last working day is before the joining date.');
  }
  const end = new Date(lastWorkingDay.getTime() + 24 * 60 * 60 * 1000);
  let months =
    (end.getUTCFullYear() - joining.getUTCFullYear()) * 12 +
    (end.getUTCMonth() - joining.getUTCMonth());
  if (end.getUTCDate() < joining.getUTCDate()) months -= 1;
  return Math.max(0, months);
}

export function formatTenure(months: number) {
  if (months < 1) return 'Less than a month';
  const years = Math.floor(months / 12);
  const rest = months % 12;
  const parts: string[] = [];
  if (years) parts.push(`${years} year${years === 1 ? '' : 's'}`);
  if (rest) parts.push(`${rest} month${rest === 1 ? '' : 's'}`);
  return parts.join(' ');
}

// ─── Portal access ────────────────────────────────────────────────────────────

export function canInvite(eligibility: AlumniEligibility) {
  return eligibility === 'eligible';
}

/** Portal (and with it every document download) needs an active login and eligibility. */
export function portalAllowed(
  accountStatus: string,
  eligibility: AlumniEligibility,
) {
  return accountStatus === 'active' && eligibility === 'eligible';
}

/** HR list status, derived from the login and the latest invitation. */
export function accessStatus(
  account: { status: string } | null | undefined,
  latestInvitation:
    | { acceptedAt: Date | null; revokedAt: Date | null; expiresAt: Date }
    | null
    | undefined,
  now = new Date(),
) {
  if (account?.status === 'active') return 'registered';
  if (
    latestInvitation &&
    !latestInvitation.acceptedAt &&
    !latestInvitation.revokedAt
  ) {
    return latestInvitation.expiresAt > now ? 'invited' : 'invite_expired';
  }
  return account ? account.status : 'not_invited'; // revoked | withdrawn
}

// ─── Profile visibility and directory ────────────────────────────────────────

export const PROFILE_FIELDS = [
  'currentEmployer',
  'currentDesignation',
  'industry',
  'location',
  'skills',
  'linkedinUrl',
  'photo',
  'phone',
  'contactEmail',
  'department',
  'batch',
  'exitYear',
] as const;

export type ProfileField = (typeof PROFILE_FIELDS)[number];
export type Visibility = Record<ProfileField, boolean>;

/** Work details are shown by default; contact details stay private until switched on. */
export const DEFAULT_VISIBILITY: Visibility = {
  currentEmployer: true,
  currentDesignation: true,
  industry: true,
  location: true,
  skills: true,
  linkedinUrl: true,
  photo: true,
  phone: false,
  contactEmail: false,
  department: true,
  batch: true,
  exitYear: true,
};

export function readVisibility(raw: unknown): Visibility {
  const stored =
    raw && typeof raw === 'object' && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {};
  const result = { ...DEFAULT_VISIBILITY };
  for (const field of PROFILE_FIELDS) {
    if (typeof stored[field] === 'boolean') result[field] = stored[field];
  }
  return result;
}

/** Rejects unknown keys and non-boolean values. */
export function parseVisibility(input: Record<string, unknown>) {
  const known = new Set<string>(PROFILE_FIELDS);
  const result: Partial<Visibility> = {};
  for (const [key, value] of Object.entries(input)) {
    if (!known.has(key)) throw new Error(`Unknown profile field: ${key}`);
    if (typeof value !== 'boolean')
      throw new Error(`Visibility for ${key} must be true or false.`);
    result[key as ProfileField] = value;
  }
  return result;
}

export type DirectoryPerson = {
  id: string;
  fullName: string;
  departmentName: string;
  joiningDate: Date;
  lastWorkingDay: Date;
  profile: {
    currentEmployer: string;
    currentDesignation: string;
    industry: string;
    location: string;
    skills: string[];
    linkedinUrl: string;
    photoPath: string;
    phone: string;
    contactEmail: string;
    visibility: unknown;
  };
};

export type DirectoryCard = {
  id: string;
  fullName: string;
  currentEmployer?: string;
  currentDesignation?: string;
  industry?: string;
  location?: string;
  skills?: string[];
  linkedinUrl?: string;
  hasPhoto?: boolean;
  phone?: string;
  contactEmail?: string;
  department?: string;
  batch?: number;
  exitYear?: number;
};

/** Only the fields the person allowed; everything else is left out entirely. */
export function directoryCard(person: DirectoryPerson): DirectoryCard {
  const show = readVisibility(person.profile.visibility);
  const p = person.profile;
  const card: DirectoryCard = { id: person.id, fullName: person.fullName };
  if (show.currentEmployer && p.currentEmployer)
    card.currentEmployer = p.currentEmployer;
  if (show.currentDesignation && p.currentDesignation)
    card.currentDesignation = p.currentDesignation;
  if (show.industry && p.industry) card.industry = p.industry;
  if (show.location && p.location) card.location = p.location;
  if (show.skills && p.skills.length) card.skills = p.skills;
  if (show.linkedinUrl && p.linkedinUrl) card.linkedinUrl = p.linkedinUrl;
  if (show.photo && p.photoPath) card.hasPhoto = true;
  if (show.phone && p.phone) card.phone = p.phone;
  if (show.contactEmail && p.contactEmail) card.contactEmail = p.contactEmail;
  if (show.department && person.departmentName)
    card.department = person.departmentName;
  if (show.batch) card.batch = person.joiningDate.getUTCFullYear();
  if (show.exitYear) card.exitYear = person.lastWorkingDay.getUTCFullYear();
  return card;
}

export type DirectoryFilters = {
  q?: string;
  department?: string;
  batch?: number;
  exitYear?: number;
  location?: string;
  industry?: string;
};

const same = (a: string | undefined, b: string) =>
  (a ?? '').trim().toLowerCase() === b.trim().toLowerCase();

/**
 * Filters run on the card, so a hidden field never matches a filter and
 * cannot be guessed by searching for it.
 */
export function matchesDirectory(
  card: DirectoryCard,
  filters: DirectoryFilters,
) {
  if (filters.department && !same(card.department, filters.department))
    return false;
  if (filters.location && !same(card.location, filters.location)) return false;
  if (filters.industry && !same(card.industry, filters.industry)) return false;
  if (filters.batch && card.batch !== filters.batch) return false;
  if (filters.exitYear && card.exitYear !== filters.exitYear) return false;
  const q = filters.q?.trim().toLowerCase();
  if (q) {
    const haystack = [
      card.fullName,
      card.currentEmployer,
      card.currentDesignation,
      ...(card.skills ?? []),
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    if (!haystack.includes(q)) return false;
  }
  return true;
}

// ─── Audience groups for announcements and events ────────────────────────────

export type Audience = {
  departments?: string[];
  exitYears?: number[];
  joinYears?: number[];
  locations?: string[];
};

export function readAudience(raw: unknown): Audience {
  const value =
    raw && typeof raw === 'object' && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {};
  const strings = (list: unknown) =>
    Array.isArray(list)
      ? list.filter(
          (item): item is string =>
            typeof item === 'string' && item.trim() !== '',
        )
      : [];
  const numbers = (list: unknown) =>
    Array.isArray(list)
      ? list.filter((item): item is number => Number.isInteger(item))
      : [];
  return {
    departments: strings(value.departments),
    exitYears: numbers(value.exitYears),
    joinYears: numbers(value.joinYears),
    locations: strings(value.locations),
  };
}

/** Empty lists mean everyone; across lists all must match, within a list any. */
export function audienceMatches(
  audience: Audience,
  person: {
    departmentName: string;
    locationName: string;
    joiningDate: Date;
    lastWorkingDay: Date;
  },
) {
  const has = (list: string[] | undefined, value: string) =>
    !list?.length || list.some((item) => same(item, value));
  const hasYear = (list: number[] | undefined, value: number) =>
    !list?.length || list.includes(value);
  return (
    has(audience.departments, person.departmentName) &&
    has(audience.locations, person.locationName) &&
    hasYear(audience.exitYears, person.lastWorkingDay.getUTCFullYear()) &&
    hasYear(audience.joinYears, person.joiningDate.getUTCFullYear())
  );
}

export function describeAudience(audience: Audience) {
  const parts: string[] = [];
  if (audience.departments?.length) parts.push(audience.departments.join(', '));
  if (audience.locations?.length) parts.push(audience.locations.join(', '));
  if (audience.joinYears?.length)
    parts.push(`Joined ${audience.joinYears.join(', ')}`);
  if (audience.exitYears?.length)
    parts.push(`Left ${audience.exitYears.join(', ')}`);
  return parts.length ? parts.join(' · ') : 'All alumni';
}

// ─── Status flows ─────────────────────────────────────────────────────────────

const REQUEST_FLOW: Record<
  AlumniDocumentRequestStatus,
  AlumniDocumentRequestStatus[]
> = {
  submitted: ['under_review', 'approved', 'rejected', 'cancelled'],
  under_review: ['approved', 'rejected', 'cancelled'],
  approved: ['issued', 'cancelled'],
  rejected: [],
  issued: [],
  cancelled: [],
};

export function canMoveRequest(
  from: AlumniDocumentRequestStatus,
  to: AlumniDocumentRequestStatus,
) {
  return REQUEST_FLOW[from].includes(to);
}

export const OPEN_REQUEST_STATUSES: AlumniDocumentRequestStatus[] = [
  'submitted',
  'under_review',
  'approved',
];

const APPLICATION_FLOW: Record<
  AlumniApplicationStatus,
  AlumniApplicationStatus[]
> = {
  applied: ['shortlisted', 'interviewing', 'offered', 'rejected', 'withdrawn'],
  shortlisted: ['interviewing', 'offered', 'rejected', 'withdrawn'],
  interviewing: ['offered', 'rejected', 'withdrawn'],
  offered: ['rehired', 'rejected', 'withdrawn'],
  rehired: [],
  rejected: [],
  withdrawn: [],
};

export function canMoveApplication(
  from: AlumniApplicationStatus,
  to: AlumniApplicationStatus,
) {
  return APPLICATION_FLOW[from].includes(to);
}

/** A rehire can start from any live application. */
export const REHIRE_FROM: AlumniApplicationStatus[] = [
  'applied',
  'shortlisted',
  'interviewing',
  'offered',
];

const REFERRAL_FLOW: Record<AlumniReferralStatus, AlumniReferralStatus[]> = {
  submitted: [
    'screening',
    'interviewing',
    'offered',
    'hired',
    'rejected',
    'withdrawn',
  ],
  screening: ['interviewing', 'offered', 'hired', 'rejected', 'withdrawn'],
  interviewing: ['offered', 'hired', 'rejected', 'withdrawn'],
  offered: ['hired', 'rejected', 'withdrawn'],
  hired: [],
  rejected: [],
  withdrawn: [],
};

export function canMoveReferral(
  from: AlumniReferralStatus,
  to: AlumniReferralStatus,
) {
  return from === to || REFERRAL_FLOW[from].includes(to);
}

export const OPEN_REFERRAL_STATUSES: AlumniReferralStatus[] = [
  'submitted',
  'screening',
  'interviewing',
  'offered',
];

/** A reward is only owed for a hired candidate; paying it needs the amount and the date. */
export function rewardProblem(input: {
  status: AlumniReferralStatus;
  rewardStatus: AlumniRewardStatus;
  rewardAmount: number | null;
  rewardPaidOn: Date | null;
}) {
  if (
    input.rewardStatus === 'not_applicable' ||
    input.rewardStatus === 'cancelled'
  )
    return null;
  if (input.status !== 'hired')
    return 'A referral reward applies only once the candidate is hired.';
  if (!input.rewardAmount || input.rewardAmount <= 0)
    return 'Enter the reward amount.';
  if (input.rewardStatus === 'paid' && !input.rewardPaidOn)
    return 'Enter the date the reward was paid.';
  return null;
}
