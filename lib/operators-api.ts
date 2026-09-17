// Клиент раздела «Операторы» — справочник наших операторов.
//
// Backend: totus_API `/api/admin/operators/*` (staff-JWT strict). Bearer-токен сотрудника
// ко всем запросам на API_BASE_URL добавляет глобальный installStaffFetch (lib/http.ts),
// поэтому здесь — обычный fetch. Контракт: docs/OPERATORS_API.md в totus_API,
// план — claude/OPERATORS_PLAN_RU.md.
//
// Связь с Room Type — по custom_room_types.operator_id: в Room Type сохраняются
// operatorId и operatorName выбранного оператора (см. components/rooms/RuleForm.tsx).

import { API_BASE_URL } from './server';

const BASE = `${API_BASE_URL}/api/admin/operators`;

/* ── Типы ──────────────────────────────────────── */

export interface Operator {
  /** Внутренний id записи справочника. */
  id: number;
  /** id оператора на витрине (990000+) — он же пишется в custom_room_types.operator_id. */
  operatorId: number;
  name: string;
  active: boolean;
  sortOrder: number;
  /** Имя отправителя писем по броням (null — подставится значение по умолчанию). */
  emailFromName: string | null;
  /** Адреса уведомлений о новых бронях, через запятую. */
  notifyEmails: string | null;
  /** Сколько Room Type закреплено за оператором (только в списке и карточке). */
  roomTypesCount?: number;
  activeRoomTypesCount?: number;
  createdBy: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface OperatorsList {
  operators: Operator[];
  /** false — миграция на сервере не прогнана, справочник пуст. */
  available: boolean;
  /** Следующий свободный operator_id — подставляется в форму создания. */
  suggestedOperatorId: number;
  /** Нижняя граница пула (990000). */
  operatorIdBase?: number;
}

export interface OperatorBody {
  name?: string;
  operatorId?: number | null;
  sortOrder?: number;
  active?: boolean;
  emailFromName?: string | null;
  notifyEmails?: string | null;
}

export interface DuplicateOperatorBody {
  name?: string;
  operatorId?: number | null;
  /** Копировать имя отправителя и адреса уведомлений (по умолчанию да). */
  copyEmails?: boolean;
  /** Создать включённым (по умолчанию копия выключена). */
  active?: boolean;
}

/** Нижняя граница пула id: у операторов Level.Travel id маленькие, пересечься нельзя. */
export const OPERATOR_ID_BASE = 990000;

/* ── Ошибки ────────────────────────────────────── */

export const OPERATORS_ERROR_MESSAGES: Record<string, string> = {
  operators_not_migrated: 'Справочник операторов не настроен на сервере (миграция)',
  operator_name_required: 'Укажите название оператора',
  operator_id_invalid: `ID оператора должен быть целым числом не меньше ${OPERATOR_ID_BASE}`,
  operator_id_taken: 'Такой ID оператора уже занят',
  operator_sort_order_invalid: 'Порядок должен быть целым числом от нуля',
  operator_emails_invalid: 'Проверьте адреса уведомлений — они должны быть через запятую',
  operator_in_use: 'Оператора нельзя удалить: за ним закреплены Room Type',
  not_found: 'Оператор не найден',
  unauthorized: 'Нужно войти заново',
  forbidden: 'Недостаточно прав',
  network: 'Нет связи с сервером API',
};

export class OperatorsApiError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = 'OperatorsApiError';
    this.status = status;
    this.code = code;
  }
}

export function operatorsErrorMessage(code: string | undefined, status: number, fallback: string): string {
  if (code && OPERATORS_ERROR_MESSAGES[code]) return OPERATORS_ERROR_MESSAGES[code];
  if (status === 401) return OPERATORS_ERROR_MESSAGES.unauthorized;
  if (status === 403) return OPERATORS_ERROR_MESSAGES.forbidden;
  if (status === 404) return OPERATORS_ERROR_MESSAGES.not_found;
  if (status === 503) return OPERATORS_ERROR_MESSAGES.operators_not_migrated;
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
    throw new OperatorsApiError(0, 'network', OPERATORS_ERROR_MESSAGES.network);
  }

  if (!response.ok) {
    let code: string | undefined;
    let serverMessage: string | undefined;
    try {
      const data = await response.json();
      if (typeof data?.error === 'string') code = data.error;
      if (typeof data?.message === 'string') serverMessage = data.message;
    } catch {
      // тело не JSON — сообщение по статусу
    }
    const message = operatorsErrorMessage(code, response.status, serverMessage || fallback);
    throw new OperatorsApiError(response.status, code || `http_${response.status}`, message);
  }

  if (response.status === 204) return {} as T;
  return response.json() as Promise<T>;
}

/* ── Запросы ────────────────────────────────── */

// GET / — список операторов со счётчиком Room Type. Отвечает и без миграции (available: false).
export function listOperators(): Promise<OperatorsList> {
  return request<OperatorsList>('', {}, 'Не удалось загрузить операторов');
}

// GET /:id
export async function getOperator(id: number): Promise<Operator> {
  const data = await request<{ operator: Operator }>(`/${id}`, {}, 'Не удалось загрузить оператора');
  return data.operator;
}

// POST / — operatorId можно не передавать: сервер выдаст следующий свободный.
export async function createOperator(body: OperatorBody): Promise<Operator> {
  const data = await request<{ ok: boolean; operator: Operator }>('', { method: 'POST', body: JSON.stringify(body) }, 'Не удалось создать оператора');
  return data.operator;
}

// PUT /:id — вместе с оператором обновляются его Room Type (roomTypesUpdated).
export async function updateOperator(id: number, body: OperatorBody): Promise<{ operator: Operator; roomTypesUpdated: number }> {
  const data = await request<{ ok: boolean; operator: Operator; roomTypesUpdated?: number }>(
    `/${id}`,
    { method: 'PUT', body: JSON.stringify(body) },
    'Не удалось сохранить оператора',
  );
  return { operator: data.operator, roomTypesUpdated: data.roomTypesUpdated || 0 };
}

// POST /:id/toggle — без тела переключает текущее состояние.
export async function toggleOperator(id: number, active?: boolean): Promise<Operator> {
  const data = await request<{ ok: boolean; operator: Operator }>(
    `/${id}/toggle`,
    { method: 'POST', body: JSON.stringify(active === undefined ? {} : { active }) },
    'Не удалось переключить оператора',
  );
  return data.operator;
}

// POST /:id/duplicate — копия с новым operator_id; Room Type не копируются.
export async function duplicateOperator(id: number, body: DuplicateOperatorBody): Promise<Operator> {
  const data = await request<{ ok: boolean; operator: Operator }>(
    `/${id}/duplicate`,
    { method: 'POST', body: JSON.stringify(body) },
    'Не удалось дублировать оператора',
  );
  return data.operator;
}

// DELETE /:id — только если за оператором не закреплён ни один Room Type.
export async function deleteOperator(id: number): Promise<void> {
  await request<{ ok: boolean }>(`/${id}`, { method: 'DELETE' }, 'Не удалось удалить оператора');
}

/* ── Хелперы ────────────────────────────────── */

/** Подпись оператора в списках: «Arlekino · 990000». */
export function operatorLabel(op: Pick<Operator, 'name' | 'operatorId'>): string {
  return `${op.name} · ${op.operatorId}`;
}
