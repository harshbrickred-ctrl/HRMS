// Alumni portal client. Tokens live under their own keys, so an alumni session
// never mixes with an employee session in the same browser.
const ACCESS_KEY = 'peopleos_alumni_access';
const REFRESH_KEY = 'peopleos_alumni_refresh';
const BASE = '/api/v1/alumni';

type Tokens = { accessToken: string; refreshToken: string };

export function hasAlumniSession() {
  return Boolean(localStorage.getItem(ACCESS_KEY));
}

function setTokens(tokens: Tokens) {
  localStorage.setItem(ACCESS_KEY, tokens.accessToken);
  localStorage.setItem(REFRESH_KEY, tokens.refreshToken);
}

export function clearAlumniSession() {
  localStorage.removeItem(ACCESS_KEY);
  localStorage.removeItem(REFRESH_KEY);
}

/** Thrown when the session is gone (expired, revoked or signed out elsewhere). */
export class AlumniSignedOut extends Error {}

async function message(res: Response) {
  try {
    const body = (await res.json()) as { message?: string | string[] };
    if (Array.isArray(body.message)) return body.message.join(', ');
    if (body.message) return body.message;
  } catch {
    /* not JSON */
  }
  return res.statusText || 'Request failed';
}

let refreshing: Promise<boolean> | null = null;

async function refresh() {
  const refreshToken = localStorage.getItem(REFRESH_KEY);
  if (!refreshToken) return false;
  const res = await fetch(`${BASE}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  });
  if (!res.ok) {
    clearAlumniSession();
    return false;
  }
  setTokens((await res.json()) as Tokens);
  return true;
}

async function send(path: string, init: RequestInit = {}, retry = true): Promise<Response> {
  const headers = new Headers(init.headers);
  if (init.body && !(init.body instanceof FormData)) headers.set('Content-Type', 'application/json');
  const access = localStorage.getItem(ACCESS_KEY);
  if (access) headers.set('Authorization', `Bearer ${access}`);
  const res = await fetch(BASE + path, { ...init, headers });
  if (res.status === 401 && retry && access) {
    refreshing ??= refresh().finally(() => {
      refreshing = null;
    });
    if (await refreshing) return send(path, init, false);
    throw new AlumniSignedOut(await message(res));
  }
  if (res.status === 401 && access) {
    clearAlumniSession();
    throw new AlumniSignedOut(await message(res));
  }
  if (!res.ok) throw new Error(await message(res));
  return res;
}

async function json<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await send(path, init);
  return (await res.json()) as T;
}

const post = (body?: unknown): RequestInit => ({ method: 'POST', body: body === undefined ? undefined : JSON.stringify(body) });

function saveBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ─── Types ────────────────────────────────────────────────────────────────────

export const PROFILE_FIELDS = [
  ['currentEmployer', 'Current employer'],
  ['currentDesignation', 'Current designation'],
  ['industry', 'Industry'],
  ['location', 'Location'],
  ['skills', 'Skills'],
  ['linkedinUrl', 'LinkedIn'],
  ['photo', 'Photo'],
  ['phone', 'Phone'],
  ['contactEmail', 'Contact email'],
  ['department', 'Department'],
  ['batch', 'Joining year (batch)'],
  ['exitYear', 'Exit year'],
] as const;
export type ProfileField = (typeof PROFILE_FIELDS)[number][0];

export type ConsentState = { granted: boolean; recordedAt: string } | null;

export type AlumniMe = {
  id: string;
  fullName: string;
  employeeCode: string;
  designation: string;
  departmentName: string;
  locationName: string;
  joiningDate: string;
  lastWorkingDay: string;
  tenure: string;
  personalEmail: string;
  loginEmail: string;
  lastLoginAt: string | null;
  profile: {
    currentEmployer: string;
    currentDesignation: string;
    industry: string;
    location: string;
    phone: string;
    contactEmail: string;
    skills: string[];
    linkedinUrl: string;
    hasPhoto: boolean;
    visibility: Record<ProfileField, boolean>;
    directoryOptIn: boolean;
  };
  consents: Record<'terms' | 'data_processing' | 'communications' | 'directory', ConsentState>;
};

export type ProfileInput = Partial<Omit<AlumniMe['profile'], 'hasPhoto' | 'directoryOptIn' | 'visibility'>> & {
  visibility?: Partial<Record<ProfileField, boolean>>;
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

export type DirectoryResult = {
  total: number;
  page: number;
  pageSize: number;
  items: DirectoryCard[];
  options: { departments: string[]; batches: number[]; exitYears: number[]; locations: string[]; industries: string[] };
};

export type DocumentType =
  | 'experience_letter'
  | 'relieving_letter'
  | 'payslip'
  | 'form16'
  | 'fnf_statement'
  | 'pf_details'
  | 'other';

export const DOCUMENT_TYPES: { value: DocumentType; label: string }[] = [
  { value: 'experience_letter', label: 'Experience letter' },
  { value: 'relieving_letter', label: 'Relieving letter' },
  { value: 'payslip', label: 'Payslip' },
  { value: 'form16', label: 'Form 16' },
  { value: 'fnf_statement', label: 'Full and final settlement statement' },
  { value: 'pf_details', label: 'PF details' },
  { value: 'other', label: 'Other document' },
];

export type AlumniDocument = {
  id: string;
  type: DocumentType;
  typeLabel: string;
  title: string;
  period: string;
  fileName: string;
  issuedAt: string;
};

export type HistoryStep = { fromStatus: string; toStatus: string; note?: string; actorType: string; at: string };

export type DocumentRequest = {
  id: string;
  type: DocumentType;
  typeLabel: string;
  period: string;
  reason: string;
  status: 'submitted' | 'under_review' | 'approved' | 'rejected' | 'issued' | 'cancelled';
  decisionNote: string;
  createdAt: string;
  documentId: string | null;
  history: HistoryStep[];
};

export type Announcement = { id: string; kind: 'announcement' | 'newsletter'; title: string; body: string; publishedAt: string | null };

export type AlumniEvent = {
  id: string;
  title: string;
  description: string;
  startsAt: string;
  endsAt: string | null;
  venue: string;
  meetingUrl: string;
  rsvpBy: string | null;
  status: 'published' | 'cancelled';
  going: number;
  spotsLeft: number | null;
  myResponse: 'going' | 'maybe' | 'declined' | null;
  myNote: string;
};

export type Job = {
  id: string;
  title: string;
  departmentName: string;
  location: string;
  employmentType: string;
  experience: string;
  description: string;
  openedAt: string | null;
  closesOn: string | null;
  myApplication: { id: string; status: string } | null;
};

export type Application = {
  id: string;
  job: { id: string; title: string; location: string };
  status: string;
  fastTrack: boolean;
  note: string;
  createdAt: string;
  history: HistoryStep[];
};

export type Referral = {
  id: string;
  job: { id: string; title: string } | null;
  candidateName: string;
  candidateEmail: string;
  relationship: string;
  note: string;
  hasResume: boolean;
  status: string;
  rewardAmount: number | null;
  rewardCurrency: string;
  rewardStatus: string;
  rewardPaidOn: string | null;
  createdAt: string;
};

export type Consents = {
  current: AlumniMe['consents'];
  history: { type: string; granted: boolean; version: string; recordedAt: string }[];
};

// ─── Sign-up and sign-in ─────────────────────────────────────────────────────

export async function checkInvitation(token: string) {
  return json<{ fullName: string; email: string; expiresAt: string; termsVersion: string }>('/auth/invitation', post({ token }));
}

export async function registerAlumni(input: {
  token: string;
  password: string;
  acceptTerms: boolean;
  acceptDataProcessing: boolean;
  communications: boolean;
  directory: boolean;
}) {
  setTokens(await json<Tokens>('/auth/register', post(input)));
}

export async function alumniLogin(email: string, password: string) {
  setTokens(await json<Tokens>('/auth/login', post({ email, password })));
}

export async function alumniLogout() {
  const refreshToken = localStorage.getItem(REFRESH_KEY);
  clearAlumniSession();
  if (refreshToken) {
    await fetch(`${BASE}/auth/logout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    }).catch(() => undefined);
  }
}

export const requestAlumniReset = (email: string) => json<{ message: string }>('/auth/password-reset/request', post({ email }));
export const verifyAlumniReset = (email: string, otp: string) =>
  json<{ resetToken: string }>('/auth/password-reset/verify', post({ email, otp }));
export const confirmAlumniReset = (resetToken: string, password: string) =>
  json<{ success: boolean }>('/auth/password-reset/confirm', post({ resetToken, password }));

// ─── Portal ───────────────────────────────────────────────────────────────────

export const fetchAlumniMe = () => json<AlumniMe>('/portal/me');
export const updateAlumniProfile = (input: ProfileInput) =>
  json<AlumniMe>('/portal/profile', { method: 'PATCH', body: JSON.stringify(input) });

export function uploadAlumniPhoto(file: File) {
  const form = new FormData();
  form.append('file', file);
  return json<AlumniMe>('/portal/profile/photo', { method: 'POST', body: form });
}

export const removeAlumniPhoto = () => json<AlumniMe>('/portal/profile/photo', { method: 'DELETE' });

/** Object URL for a photo (img tags cannot send the login token). */
export async function alumniPhotoUrl(alumniId: string) {
  const res = await send(`/portal/photos/${alumniId}`);
  return URL.createObjectURL(await res.blob());
}

export const fetchConsents = () => json<Consents>('/portal/consents');
export const setConsent = (type: 'communications' | 'directory' | 'data_processing', granted: boolean) =>
  json<Consents | { signedOut: true }>('/portal/consents', post({ type, granted }));

export const changeAlumniPassword = (currentPassword: string, newPassword: string) =>
  json<{ success: boolean }>('/portal/password/change', post({ currentPassword, newPassword }));
export const requestEmailChange = (newEmail: string, password: string) =>
  json<{ message: string }>('/portal/email-change/request', post({ newEmail, password }));
export const confirmEmailChange = (otp: string) => json<{ email: string }>('/portal/email-change/confirm', post({ otp }));

export function fetchDirectory(filters: Record<string, string | number | undefined>) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== '') query.set(key, String(value));
  }
  return json<DirectoryResult>(`/portal/directory?${query}`);
}

export const fetchMyDocuments = () => json<AlumniDocument[]>('/portal/documents');

export async function downloadMyDocument(doc: Pick<AlumniDocument, 'id' | 'fileName'>) {
  const res = await send(`/portal/documents/${doc.id}/download`);
  saveBlob(await res.blob(), doc.fileName);
}

export const fetchMyRequests = () => json<DocumentRequest[]>('/portal/document-requests');
export const createDocumentRequest = (input: { type: DocumentType; period?: string; reason: string }) =>
  json<DocumentRequest>('/portal/document-requests', post(input));
export const cancelDocumentRequest = (id: string) => json<DocumentRequest>(`/portal/document-requests/${id}/cancel`, post());

export const fetchAnnouncements = () => json<Announcement[]>('/portal/announcements');
export const fetchEvents = () => json<AlumniEvent[]>('/portal/events');
export const rsvpEvent = (id: string, response: 'going' | 'maybe' | 'declined') =>
  json<AlumniEvent>(`/portal/events/${id}/rsvp`, post({ response }));

export const fetchJobs = () => json<Job[]>('/portal/jobs');
export const applyForJob = (id: string, note: string) =>
  json<{ id: string; status: string }>(`/portal/jobs/${id}/apply`, post({ note }));
export const fetchApplications = () => json<Application[]>('/portal/applications');
export const withdrawApplication = (id: string) => json<{ id: string }>(`/portal/applications/${id}/withdraw`, post());

export const fetchReferrals = () => json<Referral[]>('/portal/referrals');

export function createReferral(input: Record<string, string>, resume: File | null) {
  const form = new FormData();
  for (const [key, value] of Object.entries(input)) if (value) form.append(key, value);
  if (resume) form.append('file', resume);
  return json<Referral>('/portal/referrals', { method: 'POST', body: form });
}

// ─── Display helpers ─────────────────────────────────────────────────────────

export function formatDay(value: string | null | undefined) {
  if (!value) return '—';
  const date = new Date(value.length === 10 ? `${value}T00:00:00Z` : value);
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: value.length === 10 ? 'UTC' : undefined });
}

export function formatDateTime(value: string | null | undefined) {
  if (!value) return '—';
  return new Date(value).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export function statusLabel(status: string) {
  return status.replace(/_/g, ' ').replace(/^\w/, (letter) => letter.toUpperCase());
}

/** Maps a status to one of the existing chip colours in ess.css. */
export function chipFor(status: string) {
  if (['approved', 'issued', 'hired', 'rehired', 'paid', 'going', 'registered', 'eligible', 'published', 'open', 'completed'].includes(status)) {
    return 'approved';
  }
  if (['rejected', 'cancelled', 'do_not_contact', 'revoked', 'withdrawn', 'not_eligible', 'declined', 'closed'].includes(status)) {
    return status === 'withdrawn' || status === 'closed' ? 'withdrawn' : 'rejected';
  }
  if (['under_review', 'screening', 'interviewing', 'shortlisted', 'offered', 'invited', 'initiated'].includes(status)) return 'inprogress';
  return 'pending';
}
