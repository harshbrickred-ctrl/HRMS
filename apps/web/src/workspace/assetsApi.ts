import { apiBlob, apiFetch } from '../lib/api';

export type AssetStatus =
  | 'in_stock'
  | 'allocated'
  | 'under_maintenance'
  | 'lost'
  | 'retired'
  | 'disposed'
  | 'written_off';

export type AckStatus = 'pending' | 'acknowledged' | 'not_recorded';
export type ReturnCondition = 'good' | 'damaged' | 'requires_repair' | 'missing_components';

export type MyAsset = {
  allocationId: string;
  assetTag: string;
  category: string;
  name: string;
  make: string;
  model: string;
  serialNo: string | null;
  status: AssetStatus;
  assignedOn: string;
  issueCondition: string;
  accessories: string;
  warrantyExpiry: string | null;
  ackStatus: AckStatus;
  ackDueOn: string | null;
  ackAt: string | null;
};

export type MyAssets = { assets: Array<MyAsset & { returnRequested: boolean }>; handovers: MyAsset[] };

export type MyAssetDetail = MyAsset & {
  purchasedOn: string | null;
  accessories: string;
  ackAt: string | null;
  ackMethod: string;
  hasPhoto: boolean;
};

export type MyAssetHistoryRow = MyAsset & {
  returnedOn: string | null;
  returnCondition: ReturnCondition | null;
  endReason: string | null;
  transferredFrom: string | null;
  transferredTo: string | null;
  handoverAckStatus: AckStatus | null;
};

export type AssetTicket = {
  id: string;
  reference: string;
  type: 'Issue' | 'Query' | 'Request' | 'Loss';
  category: string;
  priority: 'low' | 'medium' | 'high';
  subject: string;
  body: string;
  status: string;
  lostOn: string | null;
  lostLocation: string;
  asset: { id: string; assetTag: string; name: string; category: string; status: AssetStatus } | null;
  files: Array<{ id: string; fileName: string }>;
  createdAt: string;
  comments: Array<{ id: string; body: string; createdAt: string }>;
  person?: { id: string; name: string; employeeCode: string };
};

export type AssetFieldDef = {
  key: string;
  label: string;
  type: 'text' | 'number' | 'date';
  required: boolean;
};

export type AssetCategory = {
  id: string;
  code: string;
  name: string;
  tagPrefix: string;
  fields: AssetFieldDef[];
  usefulLifeMonths: number;
  active: boolean;
  assetCount?: number;
};

export type AssetRecord = {
  id: string;
  assetTag: string;
  category: { id: string; code: string; name: string };
  name: string;
  make: string;
  model: string;
  serialNo: string | null;
  status: AssetStatus;
  purchasedOn: string | null;
  vendor: string;
  owner: string;
  /** As written in an imported sheet; issue and return conditions are on the allocation. */
  condition: string;
  cost: number | null;
  bookValue: number | null;
  warrantyExpiry: string | null;
  location: { id: string; name: string } | null;
  description: string;
  customFields: Record<string, string | number>;
  hasPhoto: boolean;
  current: {
    allocationId: string;
    employeeId: string;
    name: string;
    employeeCode: string;
    department: string | null;
    assignedOn: string;
    expectedReturnOn: string | null;
    ackStatus: AckStatus;
  } | null;
};

export type AssetDetail = AssetRecord & {
  fieldDefs: AssetFieldDef[];
  nextStatuses: AssetStatus[];
  holder: {
    department: string | null;
    location: string | null;
    manager: string | null;
    issueCondition: string;
    accessories: string;
    project: string;
    contactMobile: string;
    employmentType: string;
    ackDueOn: string | null;
    ackAt: string | null;
    ackMethod: string;
  } | null;
  financials: {
    method: string;
    lifeMonths: number;
    monthsUsed: number | null;
    depreciated: number | null;
    bookValue: number | null;
    repairCost: number;
    repairs: number;
  };
  warranty: { startsOn: string | null; endsOn: string; daysLeft: number; elapsedPercent: number | null } | null;
  createdAt: string;
  updatedAt: string;
  createdBy: string | null;
  updatedBy: string | null;
};

export type AssetInput = {
  categoryId: string;
  name: string;
  make: string;
  model: string;
  serialNo: string;
  purchasedOn: string | null;
  vendor: string;
  owner: string;
  cost: number | null;
  warrantyExpiry: string | null;
  locationId: string | null;
  description: string;
  customFields: Record<string, string>;
};

/** Holder details captured when an asset is issued; columns of the asset sheet. */
export type IssueDetails = {
  project?: string;
  contactMobile?: string;
  employmentType?: string;
};

/** One row of the asset register sheet, keyed by column (see assetSheet.ts). */
export type AssetSheetRow = Record<string, string>;

/** A sheet row to import, with its line in the file for error messages. */
export type AssetSheetImportRow = { line: number; [column: string]: string | number };

export type AssetSheetImport = {
  created: Array<{ line: number; assetTag: string }>;
  failed: Array<{ line: number; message: string }>;
};

export type AssetFilters = {
  q?: string;
  status?: string;
  categoryId?: string;
  locationId?: string;
  departmentId?: string;
  /** Register quick views: region, warranty, unassigned, overdue, unacknowledged. */
  view?: string;
};

export type AssetRegisterSummary = {
  all: number;
  region: number | null;
  regionName: string | null;
  warranty: number;
  unassigned: number;
  overdue: number;
  unacknowledged: number;
};

export type PendingHandover = {
  allocationId: string;
  asset: { id: string; assetTag: string; name: string };
  from: { id: string; name: string; employeeCode: string; department: string | null };
  to: { id: string; name: string; employeeCode: string } | null;
  transferredOn: string | null;
  reason: string;
  cost: number | null;
};

export type AssetPerson = {
  id: string;
  name: string;
  employeeCode: string;
  department: string | null;
  active: boolean;
};

export type AssetAllocation = {
  id: string;
  assetId: string;
  employee: { id: string; name: string; employeeCode: string };
  assignedOn: string;
  expectedReturnOn: string | null;
  returnedOn: string | null;
  issueCondition: string;
  accessories: string;
  notes: string;
  issuedBy: string | null;
  ackStatus: AckStatus;
  ackAt: string | null;
  ackBy: string | null;
  ackMethod: string;
  returnCondition: ReturnCondition | null;
  damageNotes: string;
  inspectionNotes: string;
  returnedBy: string | null;
  endReason: 'returned' | 'transferred' | 'lost' | null;
  transferredFromId: string | null;
  transferReason: string;
  handoverAckStatus: AckStatus | null;
  handoverAckAt: string | null;
  handoverAckBy: string | null;
  files: Array<{ id: string; kind: string; fileName: string; uploadedAt: string }>;
};

export type EmployeeAllocation = AssetAllocation & {
  asset: { id: string; assetTag: string; name: string; category: string; serialNo: string | null; status: AssetStatus };
};

export type EmployeeAllocations = {
  employee: { id: string; name: string; employeeCode: string; status: string };
  current: EmployeeAllocation[];
  past: EmployeeAllocation[];
};

export type AssetHistoryEvent = {
  at: string;
  kind: string;
  title: string;
  detail: string;
  by: string | null;
};

export type AssetStatusChange = {
  id: string;
  fromStatus: AssetStatus;
  toStatus: AssetStatus;
  reason: string;
  source: string;
  changedBy: string | null;
  changedAt: string;
};

export type AssetRequest = {
  id: string;
  reference: string;
  employee: { id: string; name: string; employeeCode: string; department: string | null };
  category: { id: string; name: string };
  reason: string;
  status: 'pending_manager' | 'pending_head' | 'approved' | 'rejected' | 'fulfilled' | 'cancelled';
  manager: { name: string } | null;
  head: { name: string } | null;
  needsAdmin: boolean;
  decisions: Array<{ step: string; approved: boolean; note: string; decidedAt: string }>;
  fulfilledAt: string | null;
  createdAt: string;
};

/** The asset desk's view of a request, with what an approver needs to decide. */
export type AssetRequestRow = AssetRequest & {
  location: string | null;
  estimatedValue: number | null;
  stock: { total: number; atLocation: number };
  alreadyHolds: number;
  waitingSince: string;
};

export type DepartmentHead = {
  id: string;
  name: string;
  employees: number;
  head: { id: string; name: string; employeeCode: string } | null;
};

export type RepairStage = 'with_vendor' | 'testing' | 'ready';

export type AssetRepair = {
  id: string;
  asset: {
    id: string;
    assetTag: string;
    name: string;
    category: string;
    location: string | null;
  };
  stage: RepairStage;
  inWarranty: boolean;
  daysOpen: number;
  ticketReference: string | null;
  issue: string;
  vendor: string;
  vendorContact: string;
  startedOn: string;
  expectedOn: string | null;
  completedOn: string | null;
  cost: number | null;
  outcome: 'repaired' | 'beyond_repair' | null;
  outcomeNotes: string;
  status: 'open' | 'completed';
  overdue: boolean;
};

export type MaintenanceOverview = {
  overdueRepairs: number;
  averageRepairDays: number | null;
  repairsCompleted90Days: number;
  warrantyEnding: number;
  warrantyBatches: Array<{
    name: string;
    category: string;
    vendor: string;
    boughtOn: string | null;
    endsOn: string;
    assets: number;
    cost: number;
    bookValue: number;
    suggestion: string;
  }>;
};

export type AssetDashboard = {
  total: number;
  locations: number;
  available: number;
  allocated: number;
  underMaintenance: number;
  lost: number;
  retired: number;
  warrantyEnding: number;
  pendingApprovals: number;
  pendingOlderThan3Days: number;
  attention: {
    warranty: number;
    overdue: number;
    unacknowledged: number;
    ackLate: number;
    lost: number;
    openFaults: number;
  };
  byLocation: Array<{ location: string; locationId: string | null; total: number; allocated: number; inStock: number }>;
  activity: Array<{ id: string; assetId: string; title: string; place: string | null; at: string }>;
  byStatus: Array<{ status: AssetStatus; label: string; count: number }>;
  byCategory: Array<{
    category: string;
    total: number;
    available: number;
    allocated: number;
    underMaintenance: number;
    other: number;
  }>;
};

/** Lists stop here; the server caps them because the API has no pagination. */
export const ASSET_LIST_LIMIT = 500;

export const ASSET_STATUS_LABELS: Record<AssetStatus, string> = {
  in_stock: 'In Stock',
  allocated: 'Allocated',
  under_maintenance: 'Under Maintenance',
  lost: 'Lost',
  retired: 'Retired',
  disposed: 'Disposed',
  written_off: 'Written Off',
};

export const ACK_LABELS: Record<AckStatus, string> = {
  pending: 'Pending',
  acknowledged: 'Acknowledged',
  not_recorded: 'Not recorded',
};

export const ISSUE_CONDITIONS = [
  { value: 'new', label: 'New' },
  { value: 'good', label: 'Good' },
  { value: 'fair', label: 'Fair' },
  { value: 'damaged', label: 'Damaged' },
];

export const RETURN_CONDITIONS: Array<{ value: ReturnCondition; label: string; goesTo: string }> = [
  { value: 'good', label: 'Good', goesTo: 'In Stock' },
  { value: 'damaged', label: 'Damaged', goesTo: 'Under Maintenance' },
  { value: 'requires_repair', label: 'Requires Repair', goesTo: 'Under Maintenance' },
  { value: 'missing_components', label: 'Missing Components', goesTo: 'Under Maintenance' },
];

export const FAULT_CATEGORIES = [
  { value: 'hardware', label: 'Hardware Problem' },
  { value: 'software', label: 'Software Problem' },
  { value: 'physical_damage', label: 'Physical Damage' },
  { value: 'battery', label: 'Battery Problem' },
  { value: 'accessories_missing', label: 'Accessories Missing' },
  { value: 'other', label: 'Other' },
];

export const REQUEST_STATUS_LABELS: Record<AssetRequest['status'], string> = {
  pending_manager: 'Waiting for manager',
  pending_head: 'Waiting for department head',
  approved: 'Approved, ready to issue',
  rejected: 'Declined',
  fulfilled: 'Issued',
  cancelled: 'Cancelled',
};

export function requestChip(status: AssetRequest['status']) {
  if (status === 'pending_manager' || status === 'pending_head') return 'pending';
  if (status === 'approved' || status === 'fulfilled') return 'approved';
  return status === 'rejected' ? 'rejected' : 'withdrawn';
}

export function titleCase(value: string) {
  const text = value.replace(/_/g, ' ');
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function categoryLabel(value: string) {
  return value.replace(/_/g, ' ');
}

export function assetMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Something went wrong';
}

export function money(value: number | null | undefined) {
  if (value === null || value === undefined) return '—';
  return value.toLocaleString('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 });
}

/** Whole rupees, for tiles and tables where paise are noise. */
export function rupees(value: number | null | undefined) {
  if (value === null || value === undefined) return '—';
  return value.toLocaleString('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });
}

export function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

/** 2026-03-14 → 14 Mar 2026 */
export function shortDate(value: string | null | undefined) {
  if (!value) return '—';
  const date = new Date(`${value.slice(0, 10)}T00:00:00Z`);
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' });
}

/** Days from today to a date, negative when it has passed. */
export function daysUntil(value: string) {
  return Math.round((Date.parse(`${value.slice(0, 10)}T00:00:00Z`) - Date.parse(`${todayIso()}T00:00:00Z`)) / 86_400_000);
}

/** "10 minutes ago", "3 hours ago", "Yesterday", "4 days ago". */
export function timeAgo(iso: string) {
  const minutes = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60_000));
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.round(hours / 24);
  return days === 1 ? 'Yesterday' : `${days} days ago`;
}

export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join('');
}

/** Warranty is "ending" inside the same window the API uses. */
export const WARRANTY_WINDOW_DAYS = 30;

export const REPAIR_STAGES: Array<{ value: RepairStage; label: string }> = [
  { value: 'with_vendor', label: 'With vendor' },
  { value: 'testing', label: 'Testing' },
  { value: 'ready', label: 'Ready to return' },
];

export function openBlob(blob: Blob) {
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank', 'noopener,noreferrer');
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

function post(body?: unknown) {
  return { method: 'POST', body: body === undefined ? undefined : JSON.stringify(body) };
}

function filesForm(fields: Record<string, string>, field: string, files: File[]) {
  const body = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    if (value) body.set(key, value);
  }
  for (const file of files) body.append(field, file);
  return body;
}

// Employee self-service

export function fetchMyAssets() {
  return apiFetch<MyAssets>('/api/v1/assets/me');
}

export function fetchMyAsset(allocationId: string) {
  return apiFetch<MyAssetDetail>(`/api/v1/assets/me/allocations/${allocationId}`);
}

export function fetchMyAssetPhoto(allocationId: string) {
  return apiBlob(`/api/v1/assets/me/allocations/${allocationId}/photo`);
}

export function acknowledgeAsset(allocationId: string) {
  return apiFetch<MyAssetDetail>(`/api/v1/assets/me/allocations/${allocationId}/acknowledge`, post());
}

export function acknowledgeHandover(allocationId: string) {
  return apiFetch<{ ok: boolean }>(`/api/v1/assets/me/handovers/${allocationId}/acknowledge`, post());
}

export function uploadMySignedForm(allocationId: string, file: File) {
  return apiFetch<{ ok: boolean }>(`/api/v1/assets/me/allocations/${allocationId}/signed-form`, {
    method: 'POST',
    body: filesForm({ kind: 'signed_ack' }, 'file', [file]),
  });
}

export function fetchMyAssetHistory() {
  return apiFetch<{ current: MyAssetHistoryRow[]; past: MyAssetHistoryRow[] }>('/api/v1/assets/me/history');
}

export function fetchMyAssetTickets() {
  return apiFetch<AssetTicket[]>('/api/v1/assets/me/tickets');
}

export function createAssetQuestion(input: { assetId: string; subject: string; body: string }) {
  return apiFetch<AssetTicket>('/api/v1/assets/me/tickets', post(input));
}

export function reportAssetFault(
  input: { allocationId: string; category: string; priority: string; description: string },
  files: File[],
) {
  return apiFetch<AssetTicket>('/api/v1/assets/me/fault-reports', {
    method: 'POST',
    body: filesForm(input, 'files', files),
  });
}

export function reportAssetLoss(
  input: { allocationId: string; reportType: string; lostOn: string; location: string; description: string },
  files: File[],
) {
  return apiFetch<AssetTicket>('/api/v1/assets/me/loss-reports', {
    method: 'POST',
    body: filesForm(input, 'files', files),
  });
}

export function requestAssetReturn(allocationId: string, reason: string) {
  return apiFetch<AssetTicket>(`/api/v1/assets/me/allocations/${allocationId}/return-request`, post({ reason }));
}

export function fetchMyTicketFile(ticketId: string, fileId: string) {
  return apiBlob(`/api/v1/assets/me/tickets/${ticketId}/files/${fileId}`);
}

export function fetchMyAssetRequests() {
  return apiFetch<AssetRequest[]>('/api/v1/assets/me/requests');
}

export function createAssetRequest(input: { categoryId: string; reason: string }) {
  return apiFetch<AssetRequest>('/api/v1/assets/me/requests', post(input));
}

export function cancelAssetRequest(id: string) {
  return apiFetch<{ ok: boolean }>(`/api/v1/assets/me/requests/${id}/cancel`, post());
}

export function fetchMyAssetApprovals() {
  return apiFetch<AssetRequest[]>('/api/v1/assets/me/approvals');
}

export function decideMyAssetApproval(id: string, approve: boolean, note?: string) {
  return apiFetch<AssetRequest>(`/api/v1/assets/me/approvals/${id}`, post({ approve, note }));
}

// Register

export function fetchAssets(filters: AssetFilters = {}) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value) query.set(key, value);
  }
  const suffix = query.size ? `?${query}` : '';
  return apiFetch<AssetRecord[]>(`/api/v1/assets${suffix}`);
}

export function fetchAssetSummary() {
  return apiFetch<AssetRegisterSummary>('/api/v1/assets/summary');
}

/** The register in the asset sheet layout, with the same filters as the list. */
export function fetchAssetSheet(filters: AssetFilters = {}) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value) query.set(key, value);
  }
  const suffix = query.size ? `?${query}` : '';
  return apiFetch<AssetSheetRow[]>(`/api/v1/assets/sheet${suffix}`);
}

/** Up to 100 sheet rows at a time; each row is saved or rejected on its own. */
export function importAssetSheet(input: {
  categoryId: string;
  locationId: string | null;
  rows: AssetSheetImportRow[];
}) {
  return apiFetch<AssetSheetImport>('/api/v1/assets/sheet', post(input));
}

export function fetchAsset(id: string) {
  return apiFetch<AssetDetail>(`/api/v1/assets/${id}`);
}

export function fetchAssetPeople() {
  return apiFetch<AssetPerson[]>('/api/v1/assets/people');
}

export function fetchAssetLocations() {
  return apiFetch<Array<{ id: string; name: string }>>('/api/v1/assets/locations');
}

export function createAsset(input: AssetInput) {
  return apiFetch<AssetRecord>('/api/v1/assets', post(input));
}

export function updateAsset(id: string, input: AssetInput) {
  return apiFetch<AssetRecord>(`/api/v1/assets/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export function deleteAsset(id: string) {
  return apiFetch<{ ok: boolean }>(`/api/v1/assets/${id}`, { method: 'DELETE' });
}

export function uploadAssetPhoto(id: string, file: File) {
  const body = new FormData();
  body.set('file', file);
  return apiFetch<AssetRecord>(`/api/v1/assets/${id}/photo`, { method: 'POST', body });
}

export function fetchAssetPhoto(id: string) {
  return apiBlob(`/api/v1/assets/${id}/photo`);
}

export function fetchAssetCategories() {
  return apiFetch<AssetCategory[]>('/api/v1/assets/categories');
}

export function fetchAllAssetCategories() {
  return apiFetch<AssetCategory[]>('/api/v1/assets/categories/all');
}

export function createAssetCategory(input: {
  name: string;
  tagPrefix: string;
  fields: AssetFieldDef[];
  usefulLifeMonths?: number;
}) {
  return apiFetch<AssetCategory>('/api/v1/assets/categories', post(input));
}

export function updateAssetCategory(
  id: string,
  input: { name?: string; tagPrefix?: string; fields?: AssetFieldDef[]; usefulLifeMonths?: number; active?: boolean },
) {
  return apiFetch<AssetCategory>(`/api/v1/assets/categories/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

// Lifecycle

export function allocateAsset(
  id: string,
  input: IssueDetails & {
    employeeId: string;
    issuedOn: string;
    expectedReturnOn?: string;
    condition: string;
    accessories: string;
    notes: string;
    ackWithinDays?: number;
    notifyManager?: boolean;
  },
) {
  return apiFetch<AssetRecord>(`/api/v1/assets/${id}/assign`, post(input));
}

export function returnAsset(
  id: string,
  input: { returnedOn: string; condition: ReturnCondition; damageNotes: string; inspectionNotes: string },
  photos: File[],
) {
  return apiFetch<AssetRecord>(`/api/v1/assets/${id}/return`, {
    method: 'POST',
    body: filesForm(input, 'photos', photos),
  });
}

export function transferAsset(id: string, input: { toEmployeeId: string; transferredOn: string; reason: string }) {
  return apiFetch<AssetRecord>(`/api/v1/assets/${id}/transfer`, post(input));
}

export function changeAssetStatus(id: string, status: AssetStatus, reason: string) {
  return apiFetch<AssetRecord>(`/api/v1/assets/${id}/status`, post({ status, reason }));
}

export function fetchAssetAllocations(id: string) {
  return apiFetch<AssetAllocation[]>(`/api/v1/assets/${id}/allocations`);
}

export function fetchEmployeeAllocations(employeeId: string) {
  return apiFetch<EmployeeAllocations>(`/api/v1/assets/employees/${employeeId}/allocations`);
}

export function fetchAssetHistory(id: string) {
  return apiFetch<AssetHistoryEvent[]>(`/api/v1/assets/${id}/history`);
}

export function fetchAssetStatusHistory(id: string) {
  return apiFetch<AssetStatusChange[]>(`/api/v1/assets/${id}/status-history`);
}

export function uploadSignedForm(allocationId: string, kind: 'signed_ack' | 'handover_ack', file: File) {
  return apiFetch<{ ok: boolean }>(`/api/v1/assets/allocations/${allocationId}/files`, {
    method: 'POST',
    body: filesForm({ kind }, 'file', [file]),
  });
}

export function fetchAllocationFile(allocationId: string, fileId: string) {
  return apiBlob(`/api/v1/assets/allocations/${allocationId}/files/${fileId}`);
}

// Requests

export function fetchAssetRequests(status?: string) {
  return apiFetch<AssetRequestRow[]>(`/api/v1/assets/requests${status ? `?status=${status}` : ''}`);
}

export function askAboutAssetRequest(id: string, question: string) {
  return apiFetch<{ ok: boolean }>(`/api/v1/assets/requests/${id}/question`, post({ question }));
}

export function fetchPendingHandovers() {
  return apiFetch<PendingHandover[]>('/api/v1/assets/handovers');
}

export function decideAssetRequest(id: string, approve: boolean, note?: string) {
  return apiFetch<AssetRequest>(`/api/v1/assets/requests/${id}/decision`, post({ approve, note }));
}

export function fulfilAssetRequest(
  id: string,
  input: IssueDetails & {
    assetId: string;
    issuedOn: string;
    expectedReturnOn?: string;
    condition: string;
    accessories: string;
    notes: string;
    ackWithinDays?: number;
    notifyManager?: boolean;
  },
) {
  return apiFetch<AssetRecord>(`/api/v1/assets/requests/${id}/fulfil`, post(input));
}

export function fetchDepartmentHeads() {
  return apiFetch<DepartmentHead[]>('/api/v1/assets/departments');
}

export function setDepartmentHead(id: string, headId: string | null) {
  return apiFetch<DepartmentHead[]>(`/api/v1/assets/departments/${id}/head`, {
    method: 'PUT',
    body: JSON.stringify({ headId }),
  });
}

// Maintenance

export function fetchRepairs(status?: string, assetId?: string) {
  const query = new URLSearchParams(Object.entries({ status, assetId }).filter((entry): entry is [string, string] => !!entry[1]));
  return apiFetch<AssetRepair[]>(`/api/v1/assets/maintenance${query.size ? `?${query}` : ''}`);
}

export function fetchMaintenanceOverview() {
  return apiFetch<MaintenanceOverview>('/api/v1/assets/maintenance/overview');
}

export function setRepairStage(id: string, stage: RepairStage) {
  return apiFetch<AssetRepair>(`/api/v1/assets/maintenance/${id}/stage`, post({ stage }));
}

export function openRepair(
  assetId: string,
  input: {
    issue: string;
    vendor: string;
    vendorContact: string;
    startedOn: string;
    expectedOn?: string;
    estimatedCost?: number;
    ticketId?: string;
  },
) {
  return apiFetch<AssetRecord>(`/api/v1/assets/${assetId}/maintenance`, post(input));
}

export function updateRepair(
  id: string,
  input: { vendor: string; vendorContact: string; expectedOn: string | null; estimatedCost: number | null },
) {
  return apiFetch<AssetRepair>(`/api/v1/assets/maintenance/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export function completeRepair(
  id: string,
  input: { outcome: 'repaired' | 'beyond_repair'; completedOn: string; cost?: number; outcomeNotes: string },
) {
  return apiFetch<AssetRepair>(`/api/v1/assets/maintenance/${id}/complete`, post(input));
}

// Dashboard and reports

export function fetchAssetDashboard(filters: { locationId?: string; categoryId?: string } = {}) {
  const query = new URLSearchParams(Object.entries(filters).filter((entry): entry is [string, string] => !!entry[1]));
  return apiFetch<AssetDashboard>(`/api/v1/assets/dashboard${query.size ? `?${query}` : ''}`);
}

export function fetchAssetReport(kind: string, params: Record<string, string> = {}) {
  const query = new URLSearchParams(Object.entries(params).filter(([, value]) => value));
  return apiFetch<Array<Record<string, unknown>>>(
    `/api/v1/assets/reports/${kind}${query.size ? `?${query}` : ''}`,
  );
}

// Admin tickets

export function fetchAssetTickets() {
  return apiFetch<AssetTicket[]>('/api/v1/assets/tickets');
}

export function updateAssetTicket(id: string, status: string, note?: string) {
  return apiFetch<AssetTicket>(`/api/v1/assets/tickets/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status, note }),
  });
}

export function fetchTicketFile(ticketId: string, fileId: string) {
  return apiBlob(`/api/v1/assets/tickets/${ticketId}/files/${fileId}`);
}
