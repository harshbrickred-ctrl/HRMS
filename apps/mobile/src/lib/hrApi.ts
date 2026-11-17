import { apiBlob, apiFetch } from './api';
import { saveBlob } from './files';

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

export function personName(person: { firstName: string; lastName: string }) {
  return `${person.firstName} ${person.lastName}`.trim();
}

export function fetchHrOrg() {
  return apiFetch<HrOrg>('/hr/org');
}

export function createDepartment(name: string) {
  return apiFetch<HrNamed>('/hr/departments', { method: 'POST', body: JSON.stringify({ name }) });
}

export function renameDepartment(id: string, name: string) {
  return apiFetch<HrNamed>(`/hr/departments/${id}`, { method: 'PATCH', body: JSON.stringify({ name }) });
}

export function deleteDepartment(id: string) {
  return apiFetch<{ ok: boolean }>(`/hr/departments/${id}`, { method: 'DELETE' });
}

export function createLocation(name: string) {
  return apiFetch<HrNamed>('/hr/locations', { method: 'POST', body: JSON.stringify({ name }) });
}

export function renameLocation(id: string, name: string) {
  return apiFetch<HrNamed>(`/hr/locations/${id}`, { method: 'PATCH', body: JSON.stringify({ name }) });
}

export function deleteLocation(id: string) {
  return apiFetch<{ ok: boolean }>(`/hr/locations/${id}`, { method: 'DELETE' });
}

export function createTeam(input: { name: string; departmentId: string; managerId?: string }) {
  return apiFetch<HrTeam>('/hr/teams', { method: 'POST', body: JSON.stringify(input) });
}

export function updateTeam(
  id: string,
  input: { name?: string; departmentId?: string; managerId?: string | null },
) {
  return apiFetch<HrTeam>(`/hr/teams/${id}`, { method: 'PATCH', body: JSON.stringify(input) });
}

export function deleteTeam(id: string) {
  return apiFetch<{ ok: boolean }>(`/hr/teams/${id}`, { method: 'DELETE' });
}

export function fetchHrRoles() {
  return apiFetch<HrRole[]>('/hr/roles');
}

export function fetchHrEmployees() {
  return apiFetch<HrEmployee[]>('/hr/employees');
}

export function fetchHrEmployee(id: string) {
  return apiFetch<HrEmployee>(`/hr/employees/${id}`);
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
  return apiFetch<HrEmployee>('/hr/employees', { method: 'POST', body: JSON.stringify(input) });
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
  return apiFetch<HrEmployee>(`/hr/employees/${id}`, { method: 'PATCH', body: JSON.stringify(input) });
}

export function updateHrLeaveBalances(
  id: string,
  balances: Array<{ code: string; entitled: number; used: number; pending: number }>,
) {
  return apiFetch<HrEmployee>(`/hr/employees/${id}/leave-balances`, {
    method: 'PUT',
    body: JSON.stringify({ balances }),
  });
}

export function uploadHrDocument(employeeId: string, file: File, category: string) {
  const body = new FormData();
  body.set('file', file);
  body.set('category', category);
  return apiFetch<HrEmployee>(`/hr/employees/${employeeId}/documents`, { method: 'POST', body });
}

export function deleteHrDocument(employeeId: string, documentId: string) {
  return apiFetch<HrEmployee>(`/hr/employees/${employeeId}/documents/${documentId}`, {
    method: 'DELETE',
  });
}

export async function downloadHrDocument(employeeId: string, documentId: string, fileName: string) {
  const blob = await apiBlob(`/hr/employees/${employeeId}/documents/${documentId}`);
  await saveBlob(blob, fileName);
}

export function fetchMyEmployee() {
  return apiFetch<HrEmployee>('/hr/me');
}

export function fetchDirectory() {
  return apiFetch<DirectoryPerson[]>('/hr/me/directory');
}

export async function downloadMyDocument(documentId: string, fileName: string) {
  const blob = await apiBlob(`/hr/me/documents/${documentId}`);
  await saveBlob(blob, fileName);
}
