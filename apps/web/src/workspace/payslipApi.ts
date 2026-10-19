import { apiBlob, apiFetch } from '../lib/api';

export type PayslipDto = {
  id: string;
  employeeId: string;
  month: string;
  label: string;
  fileName: string;
  uploadedAt: string;
};

export function fetchMyPayslips() {
  return apiFetch<PayslipDto[]>('/api/v1/payslips/me');
}

export async function downloadMyPayslip(id: string, fileName: string) {
  const blob = await apiBlob(`/api/v1/payslips/me/${id}`);
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

export function fetchEmployeePayslips(employeeId: string) {
  return apiFetch<PayslipDto[]>(`/api/v1/payslips/employees/${employeeId}`);
}

export async function uploadEmployeePayslip(
  employeeId: string,
  month: string,
  label: string,
  file: File,
) {
  const body = new FormData();
  body.append('file', file);
  body.append('month', month);
  body.append('label', label);
  return apiFetch<PayslipDto>(`/api/v1/payslips/employees/${employeeId}`, {
    method: 'POST',
    body,
  });
}
