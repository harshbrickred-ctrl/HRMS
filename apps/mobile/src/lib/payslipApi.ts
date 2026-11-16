import { apiBlob, apiFetch } from './api';
import { saveBlob } from './files';

export type PayslipDto = {
  id: string;
  employeeId: string;
  month: string;
  label: string;
  fileName: string;
  uploadedAt: string;
};

export function fetchMyPayslips() {
  return apiFetch<PayslipDto[]>('/payslips/me');
}

export async function downloadMyPayslip(id: string, fileName: string) {
  const blob = await apiBlob(`/payslips/me/${id}`);
  await saveBlob(blob, fileName);
}

export function fetchEmployeePayslips(employeeId: string) {
  return apiFetch<PayslipDto[]>(`/payslips/employees/${employeeId}`);
}

export function uploadEmployeePayslip(employeeId: string, month: string, label: string, file: File) {
  const body = new FormData();
  body.append('file', file);
  body.append('month', month);
  body.append('label', label);
  return apiFetch<PayslipDto>(`/payslips/employees/${employeeId}`, {
    method: 'POST',
    body,
  });
}
