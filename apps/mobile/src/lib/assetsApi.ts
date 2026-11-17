import { apiFetch } from '@/lib/api';

export type AssetRecord = {
  id: string;
  assetTag: string;
  category: string;
  makeModel: string;
  serialNo: string;
  status: string;
  current: {
    employeeId: string;
    name: string;
    employeeCode: string;
    assignedOn: string;
  } | null;
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
  person?: { id: string; name: string; employeeCode: string };
};

export function categoryLabel(value: string) {
  return value.replace(/_/g, ' ');
}

export function fetchAssets() {
  return apiFetch<AssetRecord[]>('/assets');
}

export function fetchAssetTickets() {
  return apiFetch<AssetTicket[]>('/assets/tickets');
}
