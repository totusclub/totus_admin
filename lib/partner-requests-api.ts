// API заявок «Стать партнёром» (totus_API, /api/admin/partner-requests).
// Заявки оставляют на totus.club/partners; запросы — со staff Bearer-токеном через authFetch.

import { API_BASE_URL } from './server';
import { authFetch } from './staff-auth-api';

export type PartnerRequestKind = 'operator' | 'hotel' | 'ads' | 'other';
export type PartnerRequestStatus = 'new' | 'in_progress' | 'done' | 'rejected';

export interface PartnerRequest {
  id: number;
  company: string;
  name: string;
  email: string;
  phone: string | null;
  kind: PartnerRequestKind;
  message: string | null;
  status: PartnerRequestStatus;
  note: string | null;
  source: string;
  created_at: string;
  updated_at: string;
}

export interface PartnerRequestList {
  data: PartnerRequest[];
  total: number;
  counts: Record<PartnerRequestStatus, number>;
}

export interface ListPartnerRequestsParams {
  status?: PartnerRequestStatus | '';
  q?: string;
  limit?: number;
  offset?: number;
}

async function errorText(response: Response, prefix: string): Promise<string> {
  let message = `${prefix} (HTTP ${response.status})`;
  try {
    const data = await response.json();
    if (data?.error) message = `${prefix}: ${data.error}`;
    else if (data?.message) message = `${prefix}: ${data.message}`;
  } catch {
    // keep default message
  }
  return message;
}

// GET /api/admin/partner-requests?status=&q=&limit=&offset= → { data, total, counts }
export async function listPartnerRequests(params: ListPartnerRequestsParams = {}): Promise<PartnerRequestList> {
  const query = new URLSearchParams();
  if (params.status) query.set('status', params.status);
  if (params.q) query.set('q', params.q);
  if (params.limit != null) query.set('limit', String(params.limit));
  if (params.offset != null) query.set('offset', String(params.offset));
  const qs = query.toString();

  const response = await authFetch(`${API_BASE_URL}/api/admin/partner-requests${qs ? `?${qs}` : ''}`);
  if (!response.ok) {
    throw new Error(await errorText(response, 'Не удалось загрузить заявки'));
  }
  return response.json();
}

// PATCH /api/admin/partner-requests/:id { status?, note? } → { ok }
export async function updatePartnerRequest(
  id: number,
  patch: { status?: PartnerRequestStatus; note?: string },
): Promise<{ ok: boolean }> {
  const response = await authFetch(`${API_BASE_URL}/api/admin/partner-requests/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  });
  if (!response.ok) {
    throw new Error(await errorText(response, 'Не удалось сохранить заявку'));
  }
  return response.json();
}

// DELETE /api/admin/partner-requests/:id → { ok }
export async function deletePartnerRequest(id: number): Promise<{ ok: boolean }> {
  const response = await authFetch(`${API_BASE_URL}/api/admin/partner-requests/${id}`, { method: 'DELETE' });
  if (!response.ok) {
    throw new Error(await errorText(response, 'Не удалось удалить заявку'));
  }
  return response.json();
}
