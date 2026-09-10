// Клиент хаба уведомлений calling_api_v2 (`/api/push/*`, staff-JWT).
//
// Bearer-токен сотрудника ко всем запросам на SERVER_BASE_URL добавляет
// глобальный installStaffFetch (lib/http.ts): 401 → один refresh → повтор,
// иначе staffLogout + /login. Поэтому здесь — обычный fetch.
// Контракт: claude/PUSH_NOTIFICATIONS_PLAN_RU.md, раздел «Сотрудник».

import { SERVER_BASE_URL } from './server';

const BASE = `${SERVER_BASE_URL}/api/push`;

/* ── Типы ─────────────────────────────────────────────────────────────── */

export type PushPlatform = 'ios' | 'android' | 'web' | 'desktop';
export type CampaignType = 'promo' | 'system';
export type CampaignStatus = 'draft' | 'scheduled' | 'sending' | 'sent' | 'failed' | 'cancelled';
export type PushStatus = 'none' | 'pending' | 'deferred' | 'sent' | 'failed' | 'no_devices' | 'skipped';
export type ReminderEvent = 'departure' | 'checkin' | 'trip_end' | 'order_created';
export type OffsetUnit = 'hours' | 'days';
export type OffsetDirection = 'before' | 'after';
export type QuietBehavior = 'shift' | 'skip' | 'send';
export type ReminderAudience = 'paid' | 'all';

export interface PushStatusInfo {
  fcm: boolean;
  webpush: boolean;
  internalKey: boolean;
  quietHours?: { from: string; to: string; tz?: string } | string | null;
  categories?: { key: string; title: string; mandatory?: boolean }[];
  types?: { key: string; category?: string; title?: string }[];
  routes?: string[];
  events?: { key: string; title?: string }[];
  units?: string[];
  [key: string]: unknown;
}

export interface PushStats {
  notifications: {
    total: number;
    inapp: number;
    pushSent: number;
    pushFailed: number;
    pushDeferred: number;
    noDevices: number;
    opened: number;
    read: number;
    tokenErrors: number;
  };
  devices: { total: number; enabled: number; ios: number; android: number; web: number; desktop: number };
  byType?: Record<string, number>;
  from?: string;
  to?: string;
}

export interface HistoryItem {
  id: number;
  userId?: number;
  type: string;
  category?: string;
  title: string;
  body: string;
  data?: Record<string, unknown> | null;
  source: string;
  pushStatus: PushStatus;
  readAt?: string | null;
  openedAt?: string | null;
  createdAt: string;
  user?: { name?: string | null; email?: string | null; loyaltyId?: string | number | null } | null;
}

export interface HistoryParams {
  q?: string;
  type?: string;
  category?: string;
  status?: PushStatus | '';
  userId?: number;
  campaignId?: number;
  ruleId?: number;
  source?: string;
  from?: string;
  to?: string;
  before?: number;
  limit?: number;
}

export interface HistoryResponse {
  items: HistoryItem[];
  hasMore?: boolean;
}

export interface PushDevice {
  id: number;
  platform: PushPlatform;
  channel: 'fcm' | 'webpush';
  deviceId?: string | null;
  deviceName?: string | null;
  enabled: boolean;
  tokenTail?: string | null;
  lastSeenAt?: string | null;
}

export interface UserDevicesResponse {
  devices: PushDevice[];
  settings?: Record<string, unknown> | null;
  unread?: number;
}

export interface TestPushBody {
  userId?: number;
  loyaltyId?: string | number;
  email?: string;
  title?: string;
  body?: string;
  type?: string;
}

export interface Segment {
  platforms?: PushPlatform[];
  hasOrders?: boolean;
  departureFrom?: string;
  departureTo?: string;
  userIds?: number[];
}

export interface Audience {
  users: number;
  devices: number;
}

export interface Campaign {
  id: number;
  title: string;
  body: string;
  type: CampaignType;
  data?: { route?: string; url?: string } | null;
  segment?: Segment | null;
  status: CampaignStatus;
  respectQuietHours: boolean;
  scheduledAt?: string | null;
  audienceCount?: number | null;
  deviceCount?: number | null;
  sentCount?: number | null;
  failedCount?: number | null;
  openedCount?: number | null;
  inappCount?: number | null;
  error?: string | null;
  staff?: { id?: number; name?: string | null; email?: string | null } | string | null;
  startedAt?: string | null;
  finishedAt?: string | null;
  createdAt: string;
}

export interface CampaignBody {
  title: string;
  body: string;
  type: CampaignType;
  data?: { route?: string; url?: string };
  segment?: Segment;
  respectQuietHours?: boolean;
  scheduledAt?: string | null;
  dryRun?: boolean;
  draft?: boolean;
}

export interface CampaignsResponse {
  items: Campaign[];
  hasMore?: boolean;
}

export interface ReminderRule {
  id: number;
  name: string;
  enabled: boolean;
  event: ReminderEvent;
  offsetValue: number;
  offsetUnit: OffsetUnit;
  offsetDirection: OffsetDirection;
  sendTime?: string | null;
  quietBehavior: QuietBehavior;
  type: string;
  title: string;
  body: string;
  channels?: { push?: boolean; inapp?: boolean; email?: boolean } | null;
  audience: ReminderAudience;
  sentCount?: number | null;
  openedCount?: number | null;
  lastRunAt?: string | null;
  lastSentAt?: string | null;
}

export interface ReminderRuleBody {
  name: string;
  event: ReminderEvent;
  offsetValue: number;
  offsetUnit: OffsetUnit;
  offsetDirection: OffsetDirection;
  sendTime?: string | null;
  quietBehavior: QuietBehavior;
  type?: string;
  title: string;
  body: string;
  channels?: { push: boolean; inapp: boolean; email: boolean };
  audience: ReminderAudience;
  enabled?: boolean;
}

export interface ReminderPreview {
  title: string;
  body: string;
}

export interface RemindersRunResult {
  ok?: boolean;
  sent?: number;
  checked?: number;
  skipped?: number;
  [key: string]: unknown;
}

/* ── Ошибки ───────────────────────────────────────────────────────────── */

export const PUSH_ERROR_MESSAGES: Record<string, string> = {
  notifications_not_migrated: 'Хаб уведомлений не настроен на сервере (миграция)',
  internal_key_not_configured: 'На сервере не задан INTERNAL_API_KEY',
  webpush_disabled: 'Web Push выключен на сервере (нет VAPID-ключей)',
  fcm_disabled: 'FCM выключен на сервере',
  type_invalid: 'Неверный тип уведомления',
  body_required: 'Укажите текст уведомления',
  title_required: 'Укажите заголовок',
  user_required: 'Укажите получателя',
  user_not_found: 'Пользователь не найден',
  not_found: 'Запись не найдена',
  offset_invalid: 'Неверное смещение (0–365)',
  send_time_invalid: 'Неверное время отправки (ЧЧ:ММ)',
  segment_departure_invalid: 'Неверный диапазон дат вылета',
  scheduled_at_invalid: 'Неверная дата отправки (должна быть в будущем)',
  campaign_status_invalid: 'Действие недоступно для текущего статуса рассылки',
  already_sending: 'Рассылка уже отправляется',
  no_devices: 'У получателя нет зарегистрированных устройств',
  forbidden: 'Недостаточно прав',
  unauthorized: 'Требуется вход сотрудника',
};

export class PushApiError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = 'PushApiError';
    this.status = status;
    this.code = code;
  }
}

export function pushErrorMessage(code: string | undefined, status: number, fallback: string): string {
  if (code && PUSH_ERROR_MESSAGES[code]) return PUSH_ERROR_MESSAGES[code];
  if (status === 401) return PUSH_ERROR_MESSAGES.unauthorized;
  if (status === 403) return PUSH_ERROR_MESSAGES.forbidden;
  if (status === 404) return PUSH_ERROR_MESSAGES.not_found;
  if (status === 503) return 'Уведомления временно недоступны';
  if (code) return `${fallback}: ${code}`;
  return `${fallback} (HTTP ${status})`;
}

async function request<T>(path: string, init: RequestInit = {}, fallback = 'Ошибка запроса'): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${BASE}${path}`, {
      ...init,
      headers: {
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
        ...(init.headers || {}),
      },
    });
  } catch {
    throw new PushApiError(0, 'network', 'Уведомления временно недоступны (нет связи с сервером)');
  }

  if (!response.ok) {
    let code: string | undefined;
    let serverMessage: string | undefined;
    try {
      const data = await response.json();
      if (typeof data?.error === 'string') code = data.error;
      if (typeof data?.message === 'string') serverMessage = data.message;
    } catch {
      // тело не JSON — оставляем сообщение по статусу
    }
    const message = pushErrorMessage(code, response.status, serverMessage || fallback);
    throw new PushApiError(response.status, code || `http_${response.status}`, message);
  }

  if (response.status === 204) return {} as T;
  return response.json() as Promise<T>;
}

function qs(params: object): string {
  const query = new URLSearchParams();
  Object.entries(params as Record<string, unknown>).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    query.set(key, String(value));
  });
  const s = query.toString();
  return s ? `?${s}` : '';
}

/* ── Статус / сводка / история ────────────────────────────────────────── */

// GET /api/push/status
export function getPushStatus(): Promise<PushStatusInfo> {
  return request<PushStatusInfo>('/status', {}, 'Не удалось получить статус хаба');
}

// GET /api/push/stats?from&to
export function getPushStats(params: { from?: string; to?: string } = {}): Promise<PushStats> {
  return request<PushStats>(`/stats${qs(params)}`, {}, 'Не удалось загрузить сводку');
}

// GET /api/push/history?q&type&category&status&userId&campaignId&ruleId&source&from&to&before&limit
export function getPushHistory(params: HistoryParams = {}): Promise<HistoryResponse> {
  return request<HistoryResponse>(`/history${qs(params)}`, {}, 'Не удалось загрузить историю');
}

// GET /api/push/users/:id/devices
export function getUserDevices(userId: number): Promise<UserDevicesResponse> {
  return request<UserDevicesResponse>(`/users/${userId}/devices`, {}, 'Не удалось загрузить устройства');
}

// POST /api/push/test { userId | loyaltyId | email, title?, body?, type? }
export function sendTestPush(body: TestPushBody): Promise<Record<string, unknown>> {
  return request('/test', { method: 'POST', body: JSON.stringify(body) }, 'Не удалось отправить тестовый пуш');
}

/* ── Рассылки ─────────────────────────────────────────────────────────── */

// POST /api/push/campaigns/audience { segment, type } → { audience: {users, devices} }
export async function countAudience(segment: Segment, type: CampaignType): Promise<Audience> {
  const data = await request<{ audience: Audience }>(
    '/campaigns/audience',
    { method: 'POST', body: JSON.stringify({ segment, type }) },
    'Не удалось посчитать аудиторию',
  );
  return data.audience || { users: 0, devices: 0 };
}

// GET /api/push/campaigns?before&limit&status → { items, hasMore }
export function listCampaigns(params: { before?: number; limit?: number; status?: CampaignStatus | '' } = {}): Promise<CampaignsResponse> {
  return request<CampaignsResponse>(`/campaigns${qs(params)}`, {}, 'Не удалось загрузить рассылки');
}

// POST /api/push/campaigns
export async function createCampaign(body: CampaignBody): Promise<{ campaign?: Campaign; audience?: Audience; [k: string]: unknown }> {
  return request('/campaigns', { method: 'POST', body: JSON.stringify(body) }, 'Не удалось создать рассылку');
}

// GET /api/push/campaigns/:id
export async function getCampaign(id: number): Promise<Campaign> {
  const data = await request<{ campaign: Campaign }>(`/campaigns/${id}`, {}, 'Не удалось загрузить рассылку');
  return data.campaign;
}

// PUT /api/push/campaigns/:id (draft/scheduled)
export async function updateCampaign(id: number, body: Partial<CampaignBody>): Promise<Campaign> {
  const data = await request<{ campaign: Campaign }>(
    `/campaigns/${id}`,
    { method: 'PUT', body: JSON.stringify(body) },
    'Не удалось сохранить рассылку',
  );
  return data.campaign;
}

// POST /api/push/campaigns/:id/send
export function sendCampaign(id: number): Promise<{ ok?: boolean; campaign?: Campaign }> {
  return request(`/campaigns/${id}/send`, { method: 'POST' }, 'Не удалось отправить рассылку');
}

// POST /api/push/campaigns/:id/cancel
export function cancelCampaign(id: number): Promise<{ ok?: boolean; campaign?: Campaign }> {
  return request(`/campaigns/${id}/cancel`, { method: 'POST' }, 'Не удалось отменить рассылку');
}

// DELETE /api/push/campaigns/:id (draft/cancelled/failed)
export function deleteCampaign(id: number): Promise<{ ok?: boolean }> {
  return request(`/campaigns/${id}`, { method: 'DELETE' }, 'Не удалось удалить рассылку');
}

/* ── Напоминания (правила) ────────────────────────────────────────────── */

// GET /api/push/reminders → { rules }
export async function listReminderRules(): Promise<ReminderRule[]> {
  const data = await request<{ rules: ReminderRule[] }>('/reminders', {}, 'Не удалось загрузить правила');
  return data.rules || [];
}

// POST /api/push/reminders
export async function createReminderRule(body: ReminderRuleBody): Promise<ReminderRule> {
  const data = await request<{ rule: ReminderRule }>(
    '/reminders',
    { method: 'POST', body: JSON.stringify(body) },
    'Не удалось создать правило',
  );
  return data.rule;
}

// PUT /api/push/reminders/:id
export async function updateReminderRule(id: number, body: Partial<ReminderRuleBody>): Promise<ReminderRule> {
  const data = await request<{ rule: ReminderRule }>(
    `/reminders/${id}`,
    { method: 'PUT', body: JSON.stringify(body) },
    'Не удалось сохранить правило',
  );
  return data.rule;
}

// POST /api/push/reminders/:id/toggle { enabled? }
export async function toggleReminderRule(id: number, enabled?: boolean): Promise<ReminderRule> {
  const data = await request<{ rule: ReminderRule }>(
    `/reminders/${id}/toggle`,
    { method: 'POST', body: JSON.stringify(enabled === undefined ? {} : { enabled }) },
    'Не удалось переключить правило',
  );
  return data.rule;
}

// POST /api/push/reminders/:id/test { userId | loyaltyId | email }
export function testReminderRule(id: number, target: TestPushBody): Promise<Record<string, unknown>> {
  return request(`/reminders/${id}/test`, { method: 'POST', body: JSON.stringify(target) }, 'Не удалось отправить тест');
}

// DELETE /api/push/reminders/:id
export function deleteReminderRule(id: number): Promise<{ ok?: boolean }> {
  return request(`/reminders/${id}`, { method: 'DELETE' }, 'Не удалось удалить правило');
}

// POST /api/push/reminders/preview → { preview: {title, body} }
export async function previewReminderRule(body: Pick<ReminderRuleBody, 'title' | 'body'> & Partial<ReminderRuleBody>): Promise<ReminderPreview> {
  const data = await request<{ preview: ReminderPreview }>(
    '/reminders/preview',
    { method: 'POST', body: JSON.stringify(body) },
    'Не удалось построить предпросмотр',
  );
  return data.preview;
}

// POST /api/push/reminders/run — прогнать движок вручную
export function runReminders(): Promise<RemindersRunResult> {
  return request<RemindersRunResult>('/reminders/run', { method: 'POST' }, 'Не удалось запустить напоминания');
}
