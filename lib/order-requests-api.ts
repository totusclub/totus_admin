// API обращений по заказам (kedam_API, /api/admin/order-requests).
// Все запросы идут со staff Bearer-токеном через authFetch
// (см. lib/staff-auth-api.ts — это staff-доступ kedam, не агентский логин).

import { API_BASE_URL } from './server';
import { authFetch } from './staff-auth-api';

export type OrderRequestType = 'cancel' | 'message';
export type OrderRequestStatus = 'new' | 'in_progress' | 'done' | 'rejected';

export interface OrderRequest {
  id: number;
  order_id: number;
  type: OrderRequestType;
  message: string | null;
  status: OrderRequestStatus;
  created_at: string;
  user_id: number;
  user_name: string | null;
  user_l_name: string | null;
  user_email: string | null;
  user_phone: string | null;
}

export interface OrderRequestList {
  data: OrderRequest[];
  total: number;
}

export interface ListOrderRequestsParams {
  status?: OrderRequestStatus | '';
  limit?: number;
  offset?: number;
}

// GET /api/admin/order-requests?status=&limit=&offset= → { data, total }
export async function listOrderRequests(params: ListOrderRequestsParams = {}): Promise<OrderRequestList> {
  const query = new URLSearchParams();
  if (params.status) query.set('status', params.status);
  if (params.limit != null) query.set('limit', String(params.limit));
  if (params.offset != null) query.set('offset', String(params.offset));
  const qs = query.toString();

  const response = await authFetch(`${API_BASE_URL}/api/admin/order-requests${qs ? `?${qs}` : ''}`);
  if (!response.ok) {
    throw new Error(`Не удалось загрузить обращения (HTTP ${response.status})`);
  }
  return response.json();
}

// PATCH /api/admin/order-requests/:id { status } → { ok }
// Ошибки: 401 unauthorized / 403 forbidden / 400 invalid_status / 404.
export async function updateOrderRequestStatus(
  id: number,
  status: OrderRequestStatus,
): Promise<{ ok: boolean }> {
  const response = await authFetch(`${API_BASE_URL}/api/admin/order-requests/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status }),
  });
  if (!response.ok) {
    let message = `Не удалось обновить статус (HTTP ${response.status})`;
    try {
      const data = await response.json();
      if (data?.error) message = `Не удалось обновить статус: ${data.error}`;
      else if (data?.message) message = `Не удалось обновить статус: ${data.message}`;
    } catch {
      // keep default message
    }
    throw new Error(message);
  }
  return response.json();
}
