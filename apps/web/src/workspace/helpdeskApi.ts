import { apiFetch } from '../lib/api';

export type HelpdeskTicketDto = {
  id: string;
  category: string;
  subject: string;
  body: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  comments: Array<{ id: string; authorId: string; body: string; createdAt: string }>;
  person?: { id: string; name: string; employeeCode: string };
};

export function fetchMyTickets() {
  return apiFetch<HelpdeskTicketDto[]>('/api/v1/helpdesk/me');
}

export function createTicket(input: { category: string; subject: string; body: string }) {
  return apiFetch<HelpdeskTicketDto>('/api/v1/helpdesk/me', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function fetchCompanyTickets() {
  return apiFetch<HelpdeskTicketDto[]>('/api/v1/helpdesk');
}

export function updateTicketStatus(
  id: string,
  status: 'Open' | 'InProgress' | 'Resolved' | 'Closed',
  note?: string,
) {
  return apiFetch<HelpdeskTicketDto>(`/api/v1/helpdesk/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status, note }),
  });
}
