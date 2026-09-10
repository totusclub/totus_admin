// Клиент раздела «Отели и номера» — наши Room Type поверх предложений Level.Travel.
//
// Backend: totus_API `/api/admin/rooms/*` (staff-JWT strict). Bearer-токен сотрудника
// ко всем запросам на API_BASE_URL добавляет глобальный installStaffFetch (lib/http.ts),
// поэтому здесь — обычный fetch. Контракт: claude/CUSTOM_ROOMS_PLAN_RU.md, §4 API
// (docs/CUSTOM_ROOMS_API.md в totus_API).

import { API_BASE_URL } from './server';

const BASE = `${API_BASE_URL}/api/admin/rooms`;

/* ── Типы ─────────────────────────────────────────────────────────────── */

export type RuleType = 'percent' | 'absolute';
export type Rounding = 1 | 10 | 100;
export type ImageSource = 'lt' | 'upload';
export type PackageType = 'hotel' | 'package';

/** Статус Room Type по актуальной выдаче (GET /hotels/:id/rooms). */
export type RoomTypeStatus = 'replacing' | 'inactive' | 'source_missing' | 'margin_clamped';

export interface RoomTypeRule {
  ruleType: RuleType;
  ruleValue: number;
  rounding: Rounding;
  minPrice: number | null;
  maxPrice: number | null;
  /** null — используется глобальная настройка / не проверять. */
  minMarginType: RuleType | null;
  minMarginValue: number | null;
  /** Своя маржа на комнате (иначе подставлена глобальная). */
  ownMargin?: boolean;
  label?: string;
}

/** Правило в теле запроса: minMargin* не передаём, если выбрана глобальная. */
export interface RoomTypeRuleInput {
  ruleType: RuleType;
  ruleValue: number;
  rounding?: Rounding;
  minPrice?: number | null;
  maxPrice?: number | null;
  minMarginType?: RuleType | null;
  minMarginValue?: number | null;
}

export interface RoomImage {
  source: ImageSource;
  url: string;
}

export interface RoomFacility {
  id?: number;
  name: string;
  group_identifier?: string | null;
}

export interface RoomTypeContent {
  nameRu: string;
  nameEn: string | null;
  accommodation: string | null;
  area: number | null;
  view: string | null;
  description: string | null;
  facilities: (string | RoomFacility)[];
  images: RoomImage[];
}

/** Объект `room` из выдачи Level.Travel (hotel_rooms.result[].room). */
export interface LtRoom {
  id: number;
  name_ru?: string;
  name_en?: string;
  accommodation?: string;
  area?: number;
  description?: string;
  view?: string;
  facilities?: RoomFacility[];
  images?: { x900?: string; x900x380?: string; [key: string]: unknown }[];
  [key: string]: unknown;
}

export interface LtOfferExtras {
  cancellation_policy?: { kind?: string; description?: string } | null;
  instant_confirm?: boolean;
}

/** Предложение источника (оператор × питание) — из `rooms[].offers`. */
export interface LtOffer {
  id: string;
  meal: string;
  operator_id: number;
  operator_name: string;
  price: number;
  nights_count?: number;
  start_date?: string;
  availability?: { flight?: string; hotel?: string; tooltip?: string } | null;
  extras?: LtOfferExtras | null;
}

/** Предложение внутри группы оператора (оператор известен из группы). */
export interface OperatorOffer {
  id: string;
  meal: string;
  price: number;
  nights_count?: number;
  extras?: LtOfferExtras | null;
  availability?: LtOffer['availability'];
}

export interface OperatorRoom {
  room_id: number;
  ID: string;
  room: LtRoom;
  offers: OperatorOffer[];
  /** id наших Room Type, созданных на основе этого номера для этого оператора. */
  room_types: number[];
}

export interface OperatorGroup {
  operator_id: number;
  operator_name: string;
  rooms: OperatorRoom[];
}

export interface LtHotelRoom {
  ID: string;
  room: LtRoom;
  min_price?: number;
  meal_types?: { id: string; min_price?: number; description?: string }[];
  offers: LtOffer[];
}

export interface PreviewRow {
  offer_id?: string;
  meal: string | null;
  operator_id?: number;
  operator_name: string | null;
  provider_price: number;
  final_price: number | null;
  margin: number | null;
  margin_percent: number | null;
  margin_clamped: boolean;
  floor?: number | null;
}

export interface RoomTypeLast {
  providerPrice: number | null;
  finalPrice: number | null;
  operator: string | null;
  seenAt: string | null;
  marginClamped: boolean;
}

export interface RoomType {
  id: number;
  hotelId: number;
  hotelName: string | null;
  hotelStars: number | null;
  hotelCity: string | null;
  sourceRoomId: number;
  sourceRoomName: string | null;
  sourceSnapshot: LtRoom | null;
  operatorIds: number[];
  operatorNames: string[];
  /** null — все типы питания источника. */
  mealTypes: string[] | null;
  content: RoomTypeContent;
  rule: RoomTypeRule | null;
  ruleType: RuleType;
  ruleValue: number;
  rounding: Rounding;
  minPrice: number | null;
  maxPrice: number | null;
  minMarginType: RuleType | null;
  minMarginValue: number | null;
  packageTypes: PackageType[];
  badge: string | null;
  active: boolean;
  sortOrder: number;
  last: RoomTypeLast;
  ordersCount?: number;
  createdBy: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  /** Только в GET /hotels/:id/rooms и GET /room-types/:id. */
  ruleLabel?: string | null;
  status?: RoomTypeStatus;
  preview?: PreviewRow[];
}

export interface RoomSettings {
  minMarginType: RuleType | null;
  minMarginValue: number | null;
  rounding: Rounding;
  badge: string;
  hotelOnly: boolean;
}

/** Карточка отеля из get_grouped_hotels (+ totus_room_types). Поля LT — как отдаёт LT. */
export interface HotelSearchItem {
  hotel?: LtHotelInfo;
  hotel_id?: number;
  id?: number;
  min_price?: number;
  min_price_nights?: number;
  operators?: unknown;
  totus_room_types: number;
  [key: string]: unknown;
}

export interface LtHotelInfo {
  id: number;
  name?: string;
  name_en?: string;
  stars?: number;
  rating?: number;
  reviews_count?: number;
  city_name?: string;
  city?: string;
  region_name?: string;
  country_name?: string;
  images?: { x500?: string; webp_x620?: string; x220?: string; [key: string]: unknown }[];
  [key: string]: unknown;
}

export interface HotelSearchResult {
  request_id: string;
  status: Record<string, string> | null;
  ready_operators: string[];
  hotels: HotelSearchItem[];
  raw_meta?: { total?: number; page?: number };
}

export interface HotelRoomsResult {
  request_id: string;
  hotel_id: number;
  search_type?: number | string;
  currency?: string;
  operators: OperatorGroup[];
  rooms: LtHotelRoom[];
  room_types: RoomType[];
  settings: RoomSettings;
}

export interface PriceLogItem {
  id: number;
  requestId: string | null;
  sourceOfferId: string | null;
  operatorId: number | null;
  operatorName: string | null;
  meal: string | null;
  providerPrice: number;
  finalPrice: number;
  margin: number;
  rule: Partial<RoomTypeRule>;
  marginClamped: boolean;
  seenAt: string | null;
}

export interface ChangeLogItem {
  id: number;
  staffId: number | null;
  staffName: string | null;
  changes: Record<string, unknown>;
  createdAt: string | null;
}

export interface RoomTypeOrder {
  id: number;
  [key: string]: unknown;
}

export interface HotelSearchParams {
  to_country: string;
  to_city?: string;
  from_city?: string;
  start_date: string;
  end_date?: string;
  nights?: number | string;
  adults?: number | string;
  kids?: number | string;
  kids_ages?: string;
  /** «4,5» */
  stars?: string;
  q?: string;
  only_ours?: boolean;
  request_id?: string;
  page_number?: number;
  page_limit?: number;
  wait_ms?: number;
}

export interface RoomTypeBody {
  hotelId: number;
  hotelName?: string | null;
  hotelStars?: number | null;
  hotelCity?: string | null;
  sourceRoomId: number;
  sourceRoomName?: string | null;
  sourceSnapshot?: LtRoom | null;
  source?: { room: LtRoom };
  operatorIds: number[];
  operatorNames?: string[];
  mealTypes?: string[] | null;
  content?: Partial<RoomTypeContent> & { nameRu: string };
  rule: RoomTypeRuleInput;
  packageTypes?: PackageType[];
  badge?: string | null;
  active?: boolean;
  sortOrder?: number;
}

export interface DuplicateBody {
  name?: string;
  copyContent?: boolean;
  copyRule?: boolean;
  images?: 'same' | 'none';
}

export interface PreviewResult {
  rule: RoomTypeRule & { label: string };
  rows: PreviewRow[];
}

/* ── Ошибки ───────────────────────────────────────────────────────────── */

export const ROOMS_ERROR_MESSAGES: Record<string, string> = {
  custom_rooms_not_migrated: 'Модуль Room Type не настроен на сервере (миграция)',
  hotel_id_invalid: 'Не указан отель',
  source_room_id_invalid: 'Не указан номер-источник',
  source_room_not_found: 'Номер-источник не найден в выдаче',
  operator_required: 'Выберите хотя бы одно предложение оператора',
  name_required: 'Укажите название Room Type',
  area_invalid: 'Площадь должна быть числом',
  rule_type_invalid: 'Выберите тип правила: процент или сумма',
  rule_value_invalid: 'Укажите значение правила',
  rule_value_out_of_range: 'Значение правила вне допустимого диапазона (−90…500 % или до 10 000 000 ₽)',
  min_price_invalid: 'Минимальная цена не может быть отрицательной',
  max_price_invalid: 'Максимальная цена должна быть больше нуля',
  min_max_invalid: 'Минимальная цена больше максимальной',
  min_margin_invalid: 'Неверное значение минимальной маржи',
  request_id_required: 'Нет активного поиска — выполните поиск отелей заново',
  file_required: 'Выберите файл изображения',
  file_too_large: 'Файл больше 15 МБ',
  file_type_invalid: 'Допустимы только JPEG, PNG или WebP',
  name_invalid: 'Неверное имя файла',
  lt_enqueue_failed: 'Level.Travel не принял запрос на поиск',
  not_found: 'Room Type не найден',
  forbidden: 'Недостаточно прав',
  unauthorized: 'Требуется вход сотрудника',
  internal_error: 'Внутренняя ошибка сервера',
};

export class RoomsApiError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = 'RoomsApiError';
    this.status = status;
    this.code = code;
  }
}

export function roomsErrorMessage(code: string | undefined, status: number, fallback: string): string {
  if (code && ROOMS_ERROR_MESSAGES[code]) return ROOMS_ERROR_MESSAGES[code];
  if (status === 401) return ROOMS_ERROR_MESSAGES.unauthorized;
  if (status === 403) return ROOMS_ERROR_MESSAGES.forbidden;
  if (status === 404) return ROOMS_ERROR_MESSAGES.not_found;
  if (status === 503) return 'Раздел Room Type временно недоступен';
  if (status === 502 || status === 504) return 'Level.Travel не ответил — попробуйте ещё раз';
  if (code) return `${fallback}: ${code}`;
  return `${fallback} (HTTP ${status})`;
}

async function request<T>(path: string, init: RequestInit = {}, fallback = 'Ошибка запроса'): Promise<T> {
  const isForm = typeof FormData !== 'undefined' && init.body instanceof FormData;
  let response: Response;
  try {
    response = await fetch(`${BASE}${path}`, {
      ...init,
      headers: {
        ...(init.body && !isForm ? { 'Content-Type': 'application/json' } : {}),
        ...(init.headers || {}),
      },
    });
  } catch {
    throw new RoomsApiError(0, 'network', 'Нет связи с сервером API');
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
    const message = roomsErrorMessage(code, response.status, serverMessage || fallback);
    throw new RoomsApiError(response.status, code || `http_${response.status}`, message);
  }

  if (response.status === 204) return {} as T;
  return response.json() as Promise<T>;
}

function qs(params: object): string {
  const query = new URLSearchParams();
  Object.entries(params as Record<string, unknown>).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '' || value === false) return;
    query.set(key, value === true ? '1' : String(value));
  });
  const s = query.toString();
  return s ? `?${s}` : '';
}

/* ── Отели и номера Level.Travel ──────────────────────────────────────── */

// GET /hotels/search — enqueue + ожидание + grouped hotels (+ totus_room_types).
// Повторный вызов с request_id — без нового поиска (фильтры/страница применяются к той же выдаче).
export function searchHotels(params: HotelSearchParams): Promise<HotelSearchResult> {
  return request<HotelSearchResult>(`/hotels/search${qs(params)}`, {}, 'Не удалось выполнить поиск отелей');
}

// GET /hotels/:hotelId/rooms?request_id
export function getHotelRooms(hotelId: number, requestId: string): Promise<HotelRoomsResult> {
  return request<HotelRoomsResult>(`/hotels/${hotelId}/rooms${qs({ request_id: requestId })}`, {}, 'Не удалось загрузить номера отеля');
}

/* ── Room Type ────────────────────────────────────────────────────────── */

// GET /room-types?hotel_id&active=1|0&q → { room_types, settings }
export function listRoomTypes(params: { hotelId?: number | string; active?: boolean; q?: string } = {}): Promise<{ room_types: RoomType[]; settings: RoomSettings }> {
  return request(
    `/room-types${qs({ hotel_id: params.hotelId, active: params.active === undefined ? undefined : params.active ? '1' : '0', q: params.q })}`,
    {},
    'Не удалось загрузить Room Type',
  );
}

// GET /room-types/:id
export async function getRoomType(id: number): Promise<RoomType> {
  const data = await request<{ room_type: RoomType }>(`/room-types/${id}`, {}, 'Не удалось загрузить Room Type');
  return data.room_type;
}

// POST /room-types
export async function createRoomType(body: RoomTypeBody): Promise<RoomType> {
  const data = await request<{ ok: boolean; room_type: RoomType }>('/room-types', { method: 'POST', body: JSON.stringify(body) }, 'Не удалось создать Room Type');
  return data.room_type;
}

// PUT /room-types/:id (частично)
export async function updateRoomType(id: number, body: Partial<RoomTypeBody>): Promise<RoomType> {
  const data = await request<{ ok: boolean; room_type: RoomType }>(`/room-types/${id}`, { method: 'PUT', body: JSON.stringify(body) }, 'Не удалось сохранить Room Type');
  return data.room_type;
}

// POST /room-types/:id/toggle { active? }
export async function toggleRoomType(id: number, active?: boolean): Promise<RoomType> {
  const data = await request<{ ok: boolean; room_type: RoomType }>(
    `/room-types/${id}/toggle`,
    { method: 'POST', body: JSON.stringify(active === undefined ? {} : { active }) },
    'Не удалось переключить Room Type',
  );
  return data.room_type;
}

// DELETE /room-types/:id
export function deleteRoomType(id: number): Promise<{ ok: boolean }> {
  return request(`/room-types/${id}`, { method: 'DELETE' }, 'Не удалось удалить Room Type');
}

// POST /room-types/:id/duplicate — копия создаётся выключенной.
export async function duplicateRoomType(id: number, body: DuplicateBody = {}): Promise<RoomType> {
  const data = await request<{ ok: boolean; room_type: RoomType }>(`/room-types/${id}/duplicate`, { method: 'POST', body: JSON.stringify(body) }, 'Не удалось дублировать Room Type');
  return data.room_type;
}

// POST /room-types/preview-price { rule, offers: [{operator_name, meal, price}] }
export function previewPrice(rule: RoomTypeRuleInput, offers: { operator_name?: string | null; meal?: string | null; price: number }[]): Promise<PreviewResult> {
  return request<PreviewResult>('/room-types/preview-price', { method: 'POST', body: JSON.stringify({ rule, offers }) }, 'Не удалось рассчитать цену');
}

// GET /room-types/:id/price-log?from&to&operatorId&meal&limit
export async function getPriceLog(id: number, params: { from?: string; to?: string; operatorId?: number | string; meal?: string; limit?: number } = {}): Promise<PriceLogItem[]> {
  const data = await request<{ items: PriceLogItem[] }>(`/room-types/${id}/price-log${qs(params)}`, {}, 'Не удалось загрузить историю цен');
  return data.items || [];
}

// GET /room-types/:id/change-log
export async function getChangeLog(id: number, limit?: number): Promise<ChangeLogItem[]> {
  const data = await request<{ items: ChangeLogItem[] }>(`/room-types/${id}/change-log${qs({ limit })}`, {}, 'Не удалось загрузить историю правок');
  return data.items || [];
}

// GET /room-types/:id/orders
export async function getRoomTypeOrders(id: number, limit?: number): Promise<RoomTypeOrder[]> {
  const data = await request<{ items: RoomTypeOrder[] }>(`/room-types/${id}/orders${qs({ limit })}`, {}, 'Не удалось загрузить заказы');
  return data.items || [];
}

/* ── Фото ─────────────────────────────────────────────────────────────── */

// POST /images (multipart `image`, до 15 МБ, jpeg/png/webp) → { image: {source:'upload', url} }
export async function uploadRoomImage(file: File): Promise<RoomImage> {
  const form = new FormData();
  form.append('image', file, file.name);
  const data = await request<{ ok: boolean; image: RoomImage }>('/images', { method: 'POST', body: form }, 'Не удалось загрузить фото');
  return data.image;
}

// DELETE /images { url }
export function deleteRoomImage(url: string): Promise<{ ok: boolean }> {
  return request('/images', { method: 'DELETE', body: JSON.stringify({ url }) }, 'Не удалось удалить фото');
}

/* ── Настройки ────────────────────────────────────────────────────────── */

// GET /settings
export async function getRoomSettings(): Promise<RoomSettings> {
  const data = await request<{ settings: RoomSettings }>('/settings', {}, 'Не удалось загрузить настройки');
  return data.settings;
}

// PUT /settings { minMarginType, minMarginValue, rounding, badge, hotelOnly }
export async function updateRoomSettings(patch: Partial<RoomSettings>): Promise<RoomSettings> {
  const data = await request<{ ok: boolean; settings: RoomSettings }>('/settings', { method: 'PUT', body: JSON.stringify(patch) }, 'Не удалось сохранить настройки');
  return data.settings;
}

/* ── Хелперы ──────────────────────────────────────────────────────────── */

/** Абсолютный URL фото: свои (`/uploads/rooms/…`) лежат на totus_API, LT — по полной ссылке. */
export function imageUrl(url: string | null | undefined): string {
  if (!url) return '';
  if (/^https?:\/\//i.test(url) || url.startsWith('data:')) return url;
  return `${API_BASE_URL.replace(/\/+$/, '')}${url.startsWith('/') ? '' : '/'}${url}`;
}

/** «−10 %», «+1 500 ₽» — как ruleLabel на сервере (для списка, где label не отдаётся). */
export function ruleLabel(rule: { ruleType: RuleType; ruleValue: number } | null | undefined): string {
  if (!rule) return '—';
  const value = Number(rule.ruleValue) || 0;
  const sign = value > 0 ? '+' : value < 0 ? '−' : '';
  const abs = Math.abs(value);
  return rule.ruleType === 'percent' ? `${sign}${abs} %` : `${sign}${formatNumber(Math.round(abs))} ₽`;
}

export function formatNumber(value: number): string {
  return String(Math.round(value)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

/** «96 500 ₽», «−9 650 ₽», «—». */
export function formatMoney(value: number | null | undefined, withSign = false): string {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return '—';
  const n = Number(value);
  const sign = n < 0 ? '−' : withSign && n > 0 ? '+' : '';
  return `${sign}${formatNumber(Math.abs(n))} ₽`;
}

/** Фото LT из `room.images[]` → `{source:'lt', url}` (x900, иначе x900x380). */
export function ltRoomImages(room: LtRoom | null | undefined): RoomImage[] {
  return (room?.images || [])
    .map((im) => (typeof im === 'string' ? im : im?.x900 || im?.x900x380 || ''))
    .filter((url): url is string => Boolean(url))
    .map((url) => ({ source: 'lt' as const, url }));
}

/** Контент из объекта `room` LT — предзаполнение мастера и «сбросить к оригиналу». */
export function contentFromLtRoom(room: LtRoom | null | undefined): RoomTypeContent {
  return {
    nameRu: String(room?.name_ru || ''),
    nameEn: room?.name_en ? String(room.name_en) : null,
    accommodation: room?.accommodation ? String(room.accommodation) : null,
    area: room?.area === undefined || room?.area === null || !Number.isFinite(Number(room.area)) ? null : Number(room.area),
    view: room?.view ? String(room.view) : null,
    description: room?.description ? String(room.description) : null,
    facilities: Array.isArray(room?.facilities) ? room!.facilities! : [],
    images: ltRoomImages(room),
  };
}

export function facilityName(f: string | RoomFacility): string {
  return typeof f === 'string' ? f : f?.name || '';
}

/** Название отеля / город / звёзды из элемента grouped_hotels (структура LT может быть плоской или вложенной). */
export function hotelInfoOf(item: HotelSearchItem): { id: number; name: string; stars: number; rating: number | null; city: string; image: string; operators: string[] } {
  const h = (item.hotel || item) as LtHotelInfo;
  const id = Number(h.id || item.hotel_id || item.id || 0);
  const image = (h.images || [])
    .map((im) => (typeof im === 'string' ? im : im?.webp_x620 || im?.x500 || im?.x220 || ''))
    .find(Boolean) || '';
  const city = String(h.city_name || h.city || h.region_name || '');
  const opsRaw = (item.operators || h.operators || (item as Record<string, unknown>).operator_names) as unknown;
  const operators = Array.isArray(opsRaw)
    ? opsRaw.map((o) => (typeof o === 'string' ? o : (o as { name?: string; operator_name?: string })?.name || (o as { operator_name?: string })?.operator_name || '')).filter(Boolean)
    : [];
  return { id, name: String(h.name || h.name_en || `Отель #${id}`), stars: Number(h.stars) || 0, rating: h.rating ? Number(h.rating) : null, city, image, operators };
}
