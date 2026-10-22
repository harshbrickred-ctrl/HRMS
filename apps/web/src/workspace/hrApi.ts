import { apiBlob, apiFetch } from '../lib/api';

export type HrNamed = { id: string; name: string };

export type HrTeam = {
  id: string;
  name: string;
  departmentId: string;
  departmentName: string;
  managerId: string | null;
  managerName: string | null;
};

export type HrOrg = {
  departments: HrNamed[];
  locations: HrNamed[];
  teams: HrTeam[];
};

export type HrRole = { id: string; code: string; name: string };

export type HrLeaveBalance = {
  id: string;
  code: string;
  type: string;
  entitled: number;
  used: number;
  pending: number;
  available: number;
};

export type HrDocument = {
  id: string;
  fileName: string;
  category: string;
  uploadedAt: string;
};

export type HrEmployee = {
  id: string;
  userId: string;
  email: string;
  status: 'ACTIVE' | 'DISABLED';
  roles: string[];
  employeeCode: string;
  firstName: string;
  lastName: string;
  designation: string;
  photo: string;
  departmentId: string | null;
  departmentName: string | null;
  locationId: string | null;
  locationName: string | null;
  teamId: string | null;
  teamName: string | null;
  managerId: string | null;
  managerName: string | null;
  leaveBalances?: HrLeaveBalance[];
  documents?: HrDocument[];
};

export type DirectoryPerson = {
  id: string;
  employeeCode: string;
  firstName: string;
  lastName: string;
  designation: string;
  photo: string;
  email: string;
  status: 'ACTIVE' | 'DISABLED';
  departmentId: string | null;
  departmentName: string | null;
  locationId: string | null;
  locationName: string | null;
  teamId: string | null;
  teamName: string | null;
  managerId: string | null;
  managerName: string | null;
};

export function fetchHrOrg() {
  return apiFetch<HrOrg>('/api/v1/hr/org');
}

export function createDepartment(name: string) {
  return apiFetch<HrNamed>('/api/v1/hr/departments', {
    method: 'POST',
    body: JSON.stringify({ name }),
  });
}

export function renameDepartment(id: string, name: string) {
  return apiFetch<HrNamed>(`/api/v1/hr/departments/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ name }),
  });
}

export function deleteDepartment(id: string) {
  return apiFetch<{ ok: boolean }>(`/api/v1/hr/departments/${id}`, { method: 'DELETE' });
}

export function createLocation(name: string) {
  return apiFetch<HrNamed>('/api/v1/hr/locations', {
    method: 'POST',
    body: JSON.stringify({ name }),
  });
}

export function renameLocation(id: string, name: string) {
  return apiFetch<HrNamed>(`/api/v1/hr/locations/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ name }),
  });
}

export function deleteLocation(id: string) {
  return apiFetch<{ ok: boolean }>(`/api/v1/hr/locations/${id}`, { method: 'DELETE' });
}

export function createTeam(input: { name: string; departmentId: string; managerId?: string }) {
  return apiFetch<HrTeam>('/api/v1/hr/teams', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function updateTeam(
  id: string,
  input: { name?: string; departmentId?: string; managerId?: string | null },
) {
  return apiFetch<HrTeam>(`/api/v1/hr/teams/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export function deleteTeam(id: string) {
  return apiFetch<{ ok: boolean }>(`/api/v1/hr/teams/${id}`, { method: 'DELETE' });
}

export function fetchHrRoles() {
  return apiFetch<HrRole[]>('/api/v1/hr/roles');
}

export function fetchHrEmployees() {
  return apiFetch<HrEmployee[]>('/api/v1/hr/employees');
}

export function fetchHrEmployee(id: string) {
  return apiFetch<HrEmployee>(`/api/v1/hr/employees/${id}`);
}

export function createHrEmployee(input: {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  designation: string;
  roleCodes: string[];
  departmentId?: string;
  locationId?: string;
  teamId?: string;
  managerId?: string;
  status?: 'ACTIVE' | 'DISABLED';
}) {
  return apiFetch<HrEmployee>('/api/v1/hr/employees', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function updateHrEmployee(
  id: string,
  input: {
    firstName?: string;
    lastName?: string;
    designation?: string;
    roleCodes?: string[];
    departmentId?: string | null;
    locationId?: string | null;
    teamId?: string | null;
    managerId?: string | null;
    status?: 'ACTIVE' | 'DISABLED';
    password?: string;
  },
) {
  return apiFetch<HrEmployee>(`/api/v1/hr/employees/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export function updateHrLeaveBalances(
  id: string,
  balances: Array<{ code: string; entitled: number; used: number; pending: number }>,
) {
  return apiFetch<HrEmployee>(`/api/v1/hr/employees/${id}/leave-balances`, {
    method: 'PUT',
    body: JSON.stringify({ balances }),
  });
}

export function uploadHrDocument(employeeId: string, file: File, category: string) {
  const body = new FormData();
  body.set('file', file);
  body.set('category', category);
  return apiFetch<HrEmployee>(`/api/v1/hr/employees/${employeeId}/documents`, {
    method: 'POST',
    body,
  });
}

export function deleteHrDocument(employeeId: string, documentId: string) {
  return apiFetch<HrEmployee>(`/api/v1/hr/employees/${employeeId}/documents/${documentId}`, {
    method: 'DELETE',
  });
}

export async function downloadHrDocument(employeeId: string, documentId: string, fileName: string) {
  const blob = await apiBlob(`/api/v1/hr/employees/${employeeId}/documents/${documentId}`);
  saveBlob(blob, fileName);
}

export async function viewHrDocument(employeeId: string, documentId: string, fileName: string) {
  const blob = await apiBlob(`/api/v1/hr/employees/${employeeId}/documents/${documentId}`);
  openBlob(blob, fileName);
}

export function fetchMyEmployee() {
  return apiFetch<HrEmployee>('/api/v1/hr/me');
}

export function fetchDirectory() {
  return apiFetch<DirectoryPerson[]>('/api/v1/hr/me/directory');
}

export function adjustMyLeave(code: string, days: number, direction: 'apply' | 'withdraw') {
  return apiFetch<HrEmployee>('/api/v1/hr/me/leave', {
    method: 'POST',
    body: JSON.stringify({ code, days, direction }),
  });
}

export async function downloadMyDocument(documentId: string, fileName: string) {
  const blob = await apiBlob(`/api/v1/hr/me/documents/${documentId}`);
  saveBlob(blob, fileName);
}

export async function viewMyDocument(documentId: string, fileName: string) {
  const blob = await apiBlob(`/api/v1/hr/me/documents/${documentId}`);
  openBlob(blob, fileName);
}

function mimeFor(fileName: string) {
  const ext = fileName.split('.').pop()?.toLowerCase() ?? '';
  if (ext === 'pdf') return 'application/pdf';
  if (ext === 'png') return 'image/png';
  if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg';
  if (ext === 'doc') return 'application/msword';
  if (ext === 'docx') {
    return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  }
  if (ext === 'txt') return 'text/plain;charset=utf-8';
  return 'application/octet-stream';
}

function typedBlob(blob: Blob, fileName: string) {
  const type = mimeFor(fileName);
  return blob.type && blob.type !== 'application/octet-stream' ? blob : new Blob([blob], { type });
}

function saveBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(typedBlob(blob, fileName));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function openBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(typedBlob(blob, fileName));
  const opened = window.open(url, '_blank', 'noopener,noreferrer');
  if (!opened) {
    saveBlob(blob, fileName);
    URL.revokeObjectURL(url);
    return;
  }
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
