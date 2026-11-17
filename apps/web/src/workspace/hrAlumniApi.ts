import { apiBlob, apiFetch } from '../lib/api';
import type { DocumentType, HistoryStep } from '../alumni/alumniApi';

const BASE = '/api/v1/alumni/admin';

export type Eligibility = 'eligible' | 'not_eligible' | 'do_not_contact';
export type Access = 'not_invited' | 'invited' | 'invite_expired' | 'registered' | 'revoked' | 'withdrawn';

export const ELIGIBILITY_LABELS: Record<Eligibility, string> = {
  eligible: 'Eligible',
  not_eligible: 'Not eligible',
  do_not_contact: 'Do not contact',
};

export const ACCESS_LABELS: Record<Access, string> = {
  not_invited: 'Not invited',
  invited: 'Invited',
  invite_expired: 'Invite expired',
  registered: 'Registered',
  revoked: 'Access revoked',
  withdrawn: 'Consent withdrawn',
};

export type AlumniOverview = {
  alumni: number;
  eligible: number;
  notEligible: number;
  doNotContact: number;
  registered: number;
  invited: number;
  pendingClosures: number;
  openRequests: number;
  upcomingEvents: number;
  openJobs: number;
  openReferrals: number;
};

export type ExitClosure = {
  id: string;
  employeeId: string;
  employeeCode: string;
  employeeName: string;
  designation: string;
  departmentName: string;
  employeeLoginActive: boolean;
  joiningDate: string;
  lastWorkingDay: string;
  personalEmail: string;
  exitCompletedOn: string | null;
  fnfSettledOn: string | null;
  fnfReference: string;
  notes: string;
  alumniId: string | null;
};

export type ExitClosureInput = {
  employeeId?: string;
  joiningDate?: string;
  lastWorkingDay?: string;
  personalEmail?: string;
  exitCompletedOn?: string;
  fnfSettledOn?: string;
  fnfReference?: string;
  notes?: string;
};

export type AlumniRow = {
  id: string;
  employeeId: string;
  employeeCode: string;
  fullName: string;
  personalEmail: string;
  designation: string;
  departmentName: string;
  locationName: string;
  joiningDate: string;
  lastWorkingDay: string;
  tenure: string;
  eligibility: Eligibility;
  eligibilityReason: string;
  access: Access;
  loginEmail: string | null;
  lastLoginAt: string | null;
};

export type AlumniDetail = AlumniRow & {
  eligibilityUpdatedBy: string | null;
  eligibilityUpdatedAt: string | null;
  exitClosure: { id: string; exitCompletedOn: string | null; fnfSettledOn: string | null; fnfReference: string } | null;
  account: {
    email: string;
    status: string;
    statusReason: string;
    emailVerifiedAt: string;
    lastLoginAt: string | null;
    locked: boolean;
    communications: boolean;
    registeredAt: string;
  } | null;
  directoryOptIn: boolean;
  invitations: { id: string; email: string; sentAt: string; expiresAt: string; acceptedAt: string | null; revokedAt: string | null; revokeReason: string }[];
  consents: { type: string; granted: boolean; version: string; recordedAt: string; ipAddress: string }[];
  documents: HrAlumniDocument[];
  requests: { id: string; type: DocumentType; period: string; status: string; createdAt: string }[];
  applications: { id: string; jobTitle: string; status: string; createdAt: string }[];
  referrals: { id: string; candidateName: string; status: string; rewardStatus: string }[];
  rehires: { id: string; status: string; newEmployeeId: string | null; joiningDate: string }[];
};

export type HrAlumniDocument = {
  id: string;
  type: DocumentType;
  title: string;
  period: string;
  fileName: string;
  source: string;
  issuedAt: string;
  revokedAt: string | null;
  downloadCount: number;
};

export type HrDocumentRequest = {
  id: string;
  type: DocumentType;
  typeLabel: string;
  period: string;
  reason: string;
  status: 'submitted' | 'under_review' | 'approved' | 'rejected' | 'issued' | 'cancelled';
  decisionNote: string;
  createdAt: string;
  alumni: { id: string; fullName: string; employeeCode: string; eligibility: Eligibility };
  documentId: string | null;
  history: HistoryStep[];
};

export type Audience = { departments: string[]; exitYears: number[]; joinYears: number[]; locations: string[] };

export type HrAnnouncement = {
  id: string;
  kind: 'announcement' | 'newsletter';
  title: string;
  body: string;
  audience: Audience;
  audienceLabel: string;
  status: 'draft' | 'published' | 'archived';
  publishedAt: string | null;
  updatedAt: string;
};

export type HrEvent = {
  id: string;
  title: string;
  description: string;
  startsAt: string;
  endsAt: string | null;
  venue: string;
  meetingUrl: string;
  capacity: number | null;
  rsvpBy: string | null;
  audience: Audience;
  audienceLabel: string;
  status: 'draft' | 'published' | 'cancelled';
  counts: { going: number; maybe: number; declined: number };
};

export type HrJob = {
  id: string;
  title: string;
  departmentName: string;
  location: string;
  employmentType: string;
  experience: string;
  description: string;
  status: 'draft' | 'open' | 'closed';
  openedAt: string | null;
  closesOn: string | null;
  applications?: number;
  referrals?: number;
};

export type HrRehire = {
  id: string;
  alumniId: string;
  applicationId: string | null;
  status: 'initiated' | 'completed' | 'cancelled';
  designation: string;
  departmentId: string | null;
  locationId: string | null;
  joiningDate: string;
  workEmail: string;
  previousEmployment: {
    employeeCode: string;
    fullName: string;
    designation: string;
    departmentName: string;
    locationName: string;
    joiningDate: string;
    lastWorkingDay: string;
    tenureMonths: number;
    previousWorkEmail: string;
  };
  newEmployeeId: string | null;
  newEmployeeCode?: string;
};

export type HrApplication = {
  id: string;
  job: { id: string; title: string };
  alumni: {
    id: string;
    fullName: string;
    employeeCode: string;
    designation: string;
    departmentName: string;
    tenure: string;
    lastWorkingDay: string;
    eligibility: Eligibility;
  };
  note: string;
  status: string;
  fastTrack: boolean;
  hrNote: string;
  createdAt: string;
  rehire: HrRehire | null;
  history: HistoryStep[];
};

export type HrReferral = {
  id: string;
  job: { id: string; title: string } | null;
  alumni: { id: string; fullName: string; employeeCode: string };
  candidateName: string;
  candidateEmail: string;
  candidatePhone: string;
  relationship: string;
  note: string;
  hasResume: boolean;
  resumeFileName: string;
  status: string;
  hrNote: string;
  rewardAmount: number | null;
  rewardCurrency: string;
  rewardStatus: string;
  rewardPaidOn: string | null;
  rewardReference: string;
  createdAt: string;
  history: HistoryStep[];
};

const body = (method: string, data?: unknown): RequestInit => ({
  method,
  body: data === undefined ? undefined : JSON.stringify(data),
});

function query(params: Record<string, string | number | undefined>) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) if (value !== undefined && value !== '') search.set(key, String(value));
  const text = search.toString();
  return text ? `?${text}` : '';
}

export function saveBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Records, exit closures, eligibility, invitations
export const fetchAlumniOverview = () => apiFetch<AlumniOverview>(`${BASE}/overview`);
export const fetchExitClosures = () => apiFetch<ExitClosure[]>(`${BASE}/exit-closures`);
export const createExitClosure = (input: ExitClosureInput) => apiFetch<ExitClosure>(`${BASE}/exit-closures`, body('POST', input));
export const updateExitClosure = (id: string, input: ExitClosureInput) =>
  apiFetch<ExitClosure>(`${BASE}/exit-closures/${id}`, body('PATCH', input));
export const fetchAlumniRecords = (filters: Record<string, string | number | undefined>) =>
  apiFetch<AlumniRow[]>(`${BASE}/records${query(filters)}`);
export const fetchAlumniRecord = (id: string) => apiFetch<AlumniDetail>(`${BASE}/records/${id}`);
export const updateAlumniEmail = (id: string, personalEmail: string) =>
  apiFetch<AlumniDetail>(`${BASE}/records/${id}`, body('PATCH', { personalEmail }));
export const updateEligibility = (id: string, eligibility: Eligibility, reason: string) =>
  apiFetch<AlumniDetail>(`${BASE}/records/${id}/eligibility`, body('PATCH', { eligibility, reason }));
export const sendInvitation = (id: string) =>
  apiFetch<{ email: string; expiresAt: string; emailSent: boolean }>(`${BASE}/records/${id}/invitation`, body('POST'));
export const revokeInvitation = (id: string) => apiFetch<{ revoked: number }>(`${BASE}/records/${id}/invitation`, body('DELETE'));
export const sendInvitations = (alumniIds: string[]) =>
  apiFetch<{ results: { alumniId: string; ok: boolean; message?: string }[] }>(`${BASE}/invitations`, body('POST', { alumniIds }));

// Documents
export function uploadAlumniDocument(alumniId: string, input: { type: DocumentType; title: string; period: string }, file: File) {
  const form = new FormData();
  form.append('type', input.type);
  form.append('title', input.title);
  if (input.period) form.append('period', input.period);
  form.append('file', file);
  return apiFetch<HrAlumniDocument>(`${BASE}/records/${alumniId}/documents`, { method: 'POST', body: form });
}
export const revokeAlumniDocument = (alumniId: string, documentId: string) =>
  apiFetch<HrAlumniDocument>(`${BASE}/records/${alumniId}/documents/${documentId}`, body('DELETE'));
export async function downloadAlumniDocument(alumniId: string, doc: { id: string; fileName: string }) {
  saveBlob(await apiBlob(`${BASE}/records/${alumniId}/documents/${doc.id}/download`), doc.fileName);
}

export const fetchDocumentRequests = (status?: string) => apiFetch<HrDocumentRequest[]>(`${BASE}/document-requests${query({ status })}`);
export const reviewRequest = (id: string) => apiFetch<HrDocumentRequest>(`${BASE}/document-requests/${id}/review`, body('POST'));
export const decideRequest = (id: string, decision: 'approve' | 'reject', note: string) =>
  apiFetch<HrDocumentRequest>(`${BASE}/document-requests/${id}/decision`, body('POST', { decision, note }));
export function issueRequest(id: string, input: { title: string; period: string }, file: File) {
  const form = new FormData();
  if (input.title) form.append('title', input.title);
  if (input.period) form.append('period', input.period);
  form.append('file', file);
  return apiFetch<HrDocumentRequest>(`${BASE}/document-requests/${id}/issue`, { method: 'POST', body: form });
}

// Announcements and events
export const fetchHrAnnouncements = () => apiFetch<HrAnnouncement[]>(`${BASE}/announcements`);
export const saveAnnouncement = (id: string | null, input: Partial<HrAnnouncement>) =>
  apiFetch<HrAnnouncement>(id ? `${BASE}/announcements/${id}` : `${BASE}/announcements`, body(id ? 'PATCH' : 'POST', input));
export const publishAnnouncement = (id: string) =>
  apiFetch<HrAnnouncement & { emailed: number }>(`${BASE}/announcements/${id}/publish`, body('POST'));
export const archiveAnnouncement = (id: string) => apiFetch<HrAnnouncement>(`${BASE}/announcements/${id}/archive`, body('POST'));
export const fetchHrEvents = () => apiFetch<HrEvent[]>(`${BASE}/events`);
export const saveEvent = (id: string | null, input: Record<string, unknown>) =>
  apiFetch<HrEvent>(id ? `${BASE}/events/${id}` : `${BASE}/events`, body(id ? 'PATCH' : 'POST', input));
export const publishEvent = (id: string) => apiFetch<HrEvent & { emailed: number }>(`${BASE}/events/${id}/publish`, body('POST'));
export const cancelEvent = (id: string) => apiFetch<HrEvent>(`${BASE}/events/${id}/cancel`, body('POST'));
export const fetchEventRsvps = (id: string) =>
  apiFetch<{ alumni: { id: string; fullName: string; employeeCode: string; departmentName: string }; response: string; note: string; respondedAt: string }[]>(
    `${BASE}/events/${id}/rsvps`,
  );

// Jobs, applications, rehire, referrals
export const fetchHrJobs = () => apiFetch<HrJob[]>(`${BASE}/jobs`);
export const saveJob = (id: string | null, input: Partial<HrJob>) =>
  apiFetch<HrJob>(id ? `${BASE}/jobs/${id}` : `${BASE}/jobs`, body(id ? 'PATCH' : 'POST', input));
export const setJobStatus = (id: string, status: HrJob['status']) => apiFetch<HrJob>(`${BASE}/jobs/${id}/status`, body('POST', { status }));
export const fetchHrApplications = (filters: { jobId?: string; status?: string } = {}) =>
  apiFetch<HrApplication[]>(`${BASE}/applications${query(filters)}`);
export const setApplicationStatus = (id: string, status: string, note: string) =>
  apiFetch<{ id: string }>(`${BASE}/applications/${id}/status`, body('PATCH', { status, note }));
export const startRehire = (applicationId: string, input: Record<string, string>) =>
  apiFetch<HrRehire>(`${BASE}/applications/${applicationId}/rehire`, body('POST', input));
export const completeRehire = (id: string, input: { password: string; roleCodes: string[]; teamId?: string; managerId?: string }) =>
  apiFetch<HrRehire>(`${BASE}/rehires/${id}/complete`, body('POST', input));
export const cancelRehire = (id: string, note: string) => apiFetch<HrRehire>(`${BASE}/rehires/${id}/cancel`, body('POST', { note }));
export const fetchHrReferrals = (status?: string) => apiFetch<HrReferral[]>(`${BASE}/referrals${query({ status })}`);
export const updateReferral = (id: string, input: Record<string, unknown>) =>
  apiFetch<HrReferral>(`${BASE}/referrals/${id}`, body('PATCH', input));
export async function downloadReferralResume(referral: { id: string; resumeFileName: string }) {
  saveBlob(await apiBlob(`${BASE}/referrals/${referral.id}/resume`), referral.resumeFileName);
}
