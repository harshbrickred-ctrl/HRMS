import { apiFetch } from '../lib/api';

export type MyAsset = {
  assetId: string;
  assetTag: string;
  category: string;
  makeModel: string;
  serialNo: string;
  status: string;
  assignedOn: string;
  conditionNotes: string;
};

export type AssetTicket = {
  id: string;
  type: string;
  category: string;
  subject: string;
  body: string;
  status: string;
  asset: { id: string; assetTag: string; category: string } | null;
  createdAt: string;
  comments: Array<{ id: string; body: string; createdAt: string }>;
  person?: { id: string; name: string; employeeCode: string };
};

export type AssetRecord = {
  id: string;
  assetTag: string;
  category: string;
  makeModel: string;
  serialNo: string;
  status: string;
  purchasedOn: string | null;
  current: {
    employeeId: string;
    name: string;
    employeeCode: string;
    assignedOn: string;
  } | null;
};

export type AssetHistoryRow = {
  id: string;
  assignedOn: string;
  returnedOn: string | null;
  conditionNotes: string;
  employee: { id: string; name: string; employeeCode: string };
};

export type AssetPerson = { id: string; name: string; employeeCode: string };

export const ASSET_CATEGORIES = ['laptop', 'monitor', 'phone', 'access_card', 'other'] as const;

export function categoryLabel(value: string) {
  return value.replace(/_/g, ' ');
}

export function fetchMyAssets() {
  return apiFetch<MyAsset[]>('/api/v1/assets/me');
}

export function fetchMyAssetTickets() {
  return apiFetch<AssetTicket[]>('/api/v1/assets/me/tickets');
}

export function createAssetTicket(input: {
  type: 'Issue' | 'Query' | 'Request';
  assetId?: string;
  category?: string;
  subject: string;
  body: string;
}) {
  return apiFetch<AssetTicket>('/api/v1/assets/me/tickets', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function fetchAssets(status?: string) {
  const query = status ? `?status=${encodeURIComponent(status)}` : '';
  return apiFetch<AssetRecord[]>(`/api/v1/assets${query}`);
}

export function fetchAssetPeople() {
  return apiFetch<AssetPerson[]>('/api/v1/assets/people');
}

export function createAsset(input: {
  assetTag: string;
  category: string;
  makeModel?: string;
  serialNo?: string;
}) {
  return apiFetch<AssetRecord>('/api/v1/assets', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function assignAsset(id: string, employeeId: string, conditionNotes?: string) {
  return apiFetch<AssetRecord>(`/api/v1/assets/${id}/assign`, {
    method: 'POST',
    body: JSON.stringify({ employeeId, conditionNotes }),
  });
}

export function returnAsset(id: string, status: 'in_stock' | 'repair' | 'retired', conditionNotes?: string) {
  return apiFetch<AssetRecord>(`/api/v1/assets/${id}/return`, {
    method: 'POST',
    body: JSON.stringify({ status, conditionNotes }),
  });
}

export function fetchAssetHistory(id: string) {
  return apiFetch<AssetHistoryRow[]>(`/api/v1/assets/${id}/history`);
}

export function fetchAssetTickets() {
  return apiFetch<AssetTicket[]>('/api/v1/assets/tickets');
}

export function updateAssetTicket(id: string, status: string, note?: string) {
  return apiFetch<AssetTicket>(`/api/v1/assets/tickets/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status, note }),
  });
}
