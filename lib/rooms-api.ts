// Клиент раздела «Отели и номера» — наши Room Type поверх предложений Level.Travel.
//
// Backend: totus_API `/api/admin/rooms/*` (staff-JWT strict). Bearer-токен сотрудника
// ко всем запросам на API_BASE_URL добавляет глобальный installStaffFetch (lib/http.ts),
// поэтому здесь — обычный fetch. Контракт: claude/CUSTOM_ROOMS_PLAN_RU.md, §4 API
// (docs/CUSTOM_ROOMS_API.md в totus_API); бронирования без Level.Travel — там же, §6.
// v2 (§2.1): связь по выбранному номеру LT без обязательного оператора, режим цены
// fixed (цена Arlekino из админки) | rule (правило от цены LT), наш оператор operatorName/operatorId.
// §2.3: флаг exclusive — «продавать только наши предложения» (скрыть Level.Travel) с областью room | hotel.

import { API_BASE_URL } from './server';

const BASE = `${API_BASE_URL}/api/admin/rooms`;

/* ── Типы ─────────────────────────────────────────────────────────────── */

export type RuleType = 'percent' | 'absolute';
export type Rounding = 1 | 10 | 100;
export type ImageSource = 'lt' | 'upload';
export type PackageType = 'hotel' | 'package';
/** v2: режим цены — fixed (цена Arlekino из админки, по умолчанию) | rule (правило от цены Level.Travel). */
export type PricingMode = 'fixed' | 'rule';
/** Единица фиксированной цены: за проживание | за ночь (× nights_count предложения-шаблона). */
export type FixedPriceUnit = 'total' | 'per_night';
/** Область действия флага «продавать только наши предложения»: только номер-источник | весь отель. */
export type ExclusiveScope = 'room' | 'hotel';

/** Статус Room Type по актуальной выдаче (GET /hotels/:id/rooms). v2: `fixed` — активен, номер в выдаче, фиксированная цена;
 * диагностика: `no_offers` — номер в выдаче, но предложений нет; `no_pricing` — режим цены без цены/правила. */
export type RoomTypeStatus = 'fixed' | 'replacing' | 'inactive' | 'source_missing' | 'no_offers' | 'no_pricing' | 'margin_clamped';

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

/** v2: нормализованный режим цены (`pricing` в ответе; null — правило не задано в режиме rule). */
export interface RoomTypePricing {
  mode: PricingMode;
  fixedPrice: number | null;
  fixedPriceUnit: FixedPriceUnit;
  rule: RoomTypeRule | null;
}

/** Режим цены в теле запроса / preview: fixed → fixedPrice > 0; rule → rule обязателен. */
export interface PricingInput {
  pricingMode: PricingMode;
  fixedPrice?: number | null;
  fixedPriceUnit?: FixedPriceUnit;
  rule?: RoomTypeRuleInput | null;
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
  /** §2.3: номер закрыт для Level.Travel — на витрине его предложения LT не показываются. */
  exclusive?: boolean;
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
  /** v2: id наших Room Type с источником = этот номер (показываются под номером всегда). */
  room_types?: number[];
  /** §2.3: номер закрыт для Level.Travel — на витрине его предложения LT не показываются. */
  exclusive?: boolean;
}

/** §2.3: сводка по отелю в GET /hotels/:id/rooms — какие номера закрыты для Level.Travel. */
export interface HotelExclusive {
  /** true — у отеля есть активный Room Type с флагом «только наши предложения». */
  active: boolean;
  /** 'hotel' — закрыт весь отель; 'room' — только номера из `rooms`; null — флага нет. */
  scope: ExclusiveScope | null;
  /** id номеров-источников Level.Travel, закрытых флагом. */
  rooms: number[];
}

export interface PreviewRow {
  offer_id?: string;
  meal: string | null;
  operator_id?: number;
  operator_name: string | null;
  nights_count?: number | null;
  /** null — расчёт фиксированной цены без предложения-шаблона. */
  provider_price: number | null;
  final_price: number | null;
  margin: number | null;
  margin_percent: number | null;
  margin_clamped: boolean;
  floor?: number | null;
  mode?: PricingMode | null;
  our_operator_id?: number;
  our_operator_name?: string;
}

export interface RoomTypeLast {
  providerPrice: number | null;
  finalPrice: number | null;
  operator: string | null;
  seenAt: string | null;
  marginClamped: boolean;
  /** Диагностика (дубль lastSkipReason/lastCheckedAt). */
  skipReason?: string | null;
  checkedAt?: string | null;
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
  /** v2: необязательны — пустые = не ограничивать; заданные = замещение предложений этих операторов у номера. */
  operatorIds: number[];
  operatorNames: string[];
  /** null — все типы питания источника (одно предложение с самым дешёвым питанием). */
  mealTypes: string[] | null;
  /* v2: режим цены и наш оператор */
  pricingMode: PricingMode;
  fixedPrice: number | null;
  fixedPriceUnit: FixedPriceUnit;
  /** Название нашего оператора на витрине (по умолчанию «Arlekino»). */
  operatorName: string;
  /** id оператора в терминах LT, если известен; иначе синтетический (effectiveOperatorId). */
  operatorId: number | null;
  effectiveOperatorId?: number;
  pricing: RoomTypePricing | null;
  /** fixed → сама цена; rule → расчёт от last.providerPrice (null, если ещё не видели). */
  previewPrice: number | null;
  content: RoomTypeContent;
  rule: RoomTypeRule | null;
  /** null — правило не задано (режим fixed). */
  ruleType: RuleType | null;
  ruleValue: number | null;
  rounding: Rounding;
  minPrice: number | null;
  maxPrice: number | null;
  minMarginType: RuleType | null;
  minMarginValue: number | null;
  packageTypes: PackageType[];
  badge: string | null;
  /**
   * §2.3: «продавать только наши предложения» — предложения Level.Travel в номере/отеле
   * скрываются с витрины и не бронируются. До миграции backend всегда отдаёт false.
   */
  exclusive?: boolean;
  /** Область действия флага: только номер-источник (по умолчанию) | весь отель. */
  exclusiveScope?: ExclusiveScope;
  active: boolean;
  sortOrder: number;
  last: RoomTypeLast;
  /**
   * Диагностика витрины: причина, по которой комната НЕ была вставлена в последний ответ /hotels-rooms по её отелю
   * (`no_pricing…`, `search_type (…)`, `source_room_missing (source N; ids in result: …)`, `no_offers (…)`, `offer_map_failed (…)`);
   * null — вставлена или ещё не проверялась (см. lastCheckedAt). Требует колонок миграции (иначе всегда null).
   */
  lastSkipReason?: string | null;
  lastCheckedAt?: string | null;
  ordersCount?: number;
  createdBy: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  /** Только в GET /hotels/:id/rooms и GET /room-types/:id. */
  ruleLabel?: string | null;
  /** «1 ₽ (фикс.)», «1 500 ₽/ночь (фикс.)», «−10 %» — только в GET /hotels/:id/rooms и GET /room-types/:id. */
  pricingLabel?: string | null;
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
  /** §2.3: какие номера отеля закрыты для Level.Travel (до миграции — active:false). */
  exclusive?: HotelExclusive;
}

/** Слепок цены (price-log, заказы): v1 — { type, value, label }; v2 — { mode:'fixed', fixedPrice, unit, label } | { mode:'rule', type, value, … }. */
export interface PriceRuleSnapshot {
  mode?: PricingMode;
  type?: RuleType;
  value?: number | null;
  fixedPrice?: number | null;
  unit?: FixedPriceUnit;
  operator?: string | null;
  label?: string | null;
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
  /** Слепок правила на момент показа (rule_snapshot): { type, value, label }. */
  rule: PriceRuleSnapshot;
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

/** Заказ по Room Type (GET /room-types/:id/orders) — как отдаёт backend. */
export interface RoomTypeOrder {
  orderId: string;
  userId: number | null;
  payStatus: string | null;
  orderState: string | null;
  providerPrice: number;
  finalPrice: number;
  rule: PriceRuleSnapshot;
}

/** GET /diagnostics — почему Room Type не виден на витрине (docs/CUSTOM_ROOMS_API.md §7). Отвечает и при 503 у остальных маршрутов. */
export interface DiagnosticsRoomType {
  id: number;
  hotelId: number;
  hotelName: string | null;
  sourceRoomId: number;
  sourceRoomName: string | null;
  pricingMode: PricingMode;
  pricingOk: boolean;
  pricingLabel: string | null;
  packageTypes: PackageType[];
  lastSeenAt: string | null;
  lastCheckedAt: string | null;
  lastSkipReason: string | null;
}

export interface DiagnosticsMiddleware {
  /** false — app.use(require('./middleware/customRooms')) не подключён или процесс не перезапущен. */
  mounted: boolean;
  middlewareCalls: number;
  watchedCalls: number;
  notReadySkips: number;
  startSearchSeen: number;
  hotelsRoomsSeen: number;
  hotelsRoomsInjected: number;
  hotelsRoomsErrors: number;
  lastStartSearchAt: string | null;
  lastHotelsRoomsAt: string | null;
  lastHotelsRoomsHotelId: string | null;
  lastHotelsRoomsSearchType: string | null;
  lastInjectAt: string | null;
  lastError: { at: string; message: string } | null;
  /** С какого момента считаются счётчики (pm2 restart обнуляет). */
  startedAt: string;
}

export interface Diagnostics {
  ready: boolean;
  disabledReason: string | null;
  missingTables: string[];
  missingColumns: string[];
  diagColumns: boolean;
  /** §2.3: false — колонок exclusive/exclusive_scope нет, флаг «только наши предложения» сохранять нельзя. */
  exclusiveColumns?: boolean;
  checkedAt: string | null;
  dbError: string | null;
  settings: RoomSettings | null;
  env: { hotelSearchTypeCodes: string };
  activeRoomTypes: DiagnosticsRoomType[];
  appJsHooks: { middleware: DiagnosticsMiddleware; adminRoutes: boolean };
  events: { at: string; line: string; error?: boolean }[];
  /** Подсказки по-русски — что проверить владельцу. */
  hints: string[];
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
  /** v2: необязательны (пустые = не ограничивать). */
  operatorIds?: number[];
  operatorNames?: string[];
  mealTypes?: string[] | null;
  content?: Partial<RoomTypeContent> & { nameRu: string };
  /** v2: default fixed; тело без pricingMode, но с rule → rule. */
  pricingMode?: PricingMode;
  fixedPrice?: number | null;
  fixedPriceUnit?: FixedPriceUnit;
  operatorName?: string;
  operatorId?: number | null;
  /** Обязательно только при pricingMode='rule'. */
  rule?: RoomTypeRuleInput | null;
  /** Пустые = любой тип поиска. */
  packageTypes?: PackageType[];
  badge?: string | null;
  /** §2.3: не передано — значение не меняется. */
  exclusive?: boolean;
  exclusiveScope?: ExclusiveScope;
  active?: boolean;
  sortOrder?: number;
}

export interface DuplicateBody {
  name?: string;
  copyContent?: boolean;
  copyRule?: boolean;
  images?: 'same' | 'none';
  /** §2.3: не передано — флаг копируется с оригинала. */
  exclusive?: boolean;
  exclusiveScope?: ExclusiveScope;
}

export interface PreviewOfferInput {
  operator_name?: string | null;
  meal?: string | null;
  price: number;
  nights_count?: number | null;
}

/** POST /room-types/preview-price: rule → { pricingMode:'rule', rule, offers }; fixed → { pricingMode:'fixed', fixedPrice, fixedPriceUnit, offers? | nights? }. */
export interface PreviewPriceBody extends PricingInput {
  offers?: PreviewOfferInput[];
  nights?: number | null;
}

export interface PreviewResult {
  pricingMode: PricingMode;
  fixedPrice: number | null;
  fixedPriceUnit: FixedPriceUnit;
  /** «1 ₽ (фикс.)» / «−10 %». */
  label: string | null;
  rule: (RoomTypeRule & { label: string }) | null;
  rows: PreviewRow[];
}

/* ── Бронирования наших Room Type (без Level.Travel) ──────────────────── */
// Контракт: docs/CUSTOM_ROOMS_API.md §6 в totus_API (`/api/admin/rooms/bookings/*`).

export type BookingStatus = 'pending_payment' | 'pending_confirmation' | 'confirmed' | 'rejected' | 'cancelled';
export type BookingPaymentStatus = 'pending' | 'paid' | 'failed' | 'refund_pending' | 'refunded' | 'partially_refunded';
export type BookingRejectReason = 'no_availability' | 'price_changed' | 'data_error' | 'other';
/** Фильтр списка: pending = pending_confirmation, rejected = rejected + cancelled, refund = refund_status='pending'. */
export type BookingListStatus = 'all' | 'pending' | 'confirmed' | 'rejected' | 'refund' | 'unpaid';
export type BookingEventType = 'created' | 'paid' | 'payment_failed' | 'confirmed' | 'rejected' | 'cancelled' | 'refund_done' | 'voucher_uploaded' | 'voucher_sent' | 'comment' | 'notified';

export interface BookingRefund {
  amount: number | null;
  method: 'manual';
  status: 'pending' | 'done';
  at: string | null;
}

export interface BookingVoucher {
  url: string;
  title: string;
  sentAt: string | null;
}

export interface BookingCustomer {
  name: string | null;
  phone: string | null;
  email: string | null;
}

/** Элемент списка: totus_booking (§6.2) + поля для админки. */
export interface Booking {
  internal: true;
  bookingId: number;
  orderId: string;
  operator: string;
  status: BookingStatus;
  statusLabel: string;
  statusText: string;
  paymentStatus: BookingPaymentStatus;
  paidAt: string | null;
  paidAmount: number | null;
  hotelBookingRef: string | null;
  confirmedAt: string | null;
  clientMessage: string | null;
  rejectedAt: string | null;
  rejectReason: BookingRejectReason | null;
  rejectReasonLabel: string | null;
  rejectMessage: string | null;
  refund: BookingRefund | null;
  voucher: BookingVoucher | null;
  hotel: { id: number | null; name: string | null; stars: number | null; city: string | null };
  room: string | null;
  meal: string | null;
  mealName: string | null;
  checkIn: string | null;
  checkOut: string | null;
  nights: number | null;
  adults: number | null;
  kids: number | null;
  providerPrice: number | null;
  finalPrice: number | null;
  priceRule: (PriceRuleSnapshot & { label: string | null }) | null;
  /** ПД покупателя — показываем в админке, в логи/URL не выносим. */
  customer: BookingCustomer;
  createdAt: string | null;
  updatedAt: string | null;
  staffComment: string | null;
  confirmedBy: string | null;
  rejectedBy: string | null;
  refundBy: string | null;
  roomTypeId: number;
  sourceRoomName: string | null;
  hotelCountry: string | null;
  touristsCount: number;
}

/** Турист как пришёл в create-package (формат LT; поля не гарантированы). */
export interface BookingTourist {
  first_name?: string;
  last_name?: string;
  firstName?: string;
  lastName?: string;
  name?: string;
  surname?: string;
  birthday?: string;
  [key: string]: unknown;
}

export interface BookingEvent {
  id: number;
  type: BookingEventType | string;
  staffName: string | null;
  payload: Record<string, unknown> | null;
  createdAt: string | null;
}

export interface BookingDetails {
  booking: Booking & {
    tourists: BookingTourist[];
    contact: Record<string, unknown> | null;
    hotelSnapshot: Record<string, unknown> | null;
    roomSnapshot: Record<string, unknown> | null;
    packageId: string | null;
    sourceOfferId: string | null;
  };
  roomType: { id: number; name: string | null; sourceRoomName: string | null; hotelName?: string | null; active?: boolean };
  events: BookingEvent[];
  order: { orderId: string; payStatus: string | null; transactionCode: string | null; orderState: string | null; payUrl: string | null; payAmount: number | null };
}

export interface BookingsSummary {
  pending: number;
  confirmed30d: number;
  rejected: number;
  refundPending: number;
  refundPendingAmount: number;
}

export interface BookingsListParams {
  status?: BookingListStatus;
  hotel_id?: number | string;
  operator?: string;
  q?: string;
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
}

export interface BookingsListResult {
  items: Booking[];
  total: number;
  page: number;
  limit: number;
  summary: BookingsSummary;
}

export interface ConfirmBookingBody {
  hotelBookingRef?: string | null;
  clientMessage?: string | null;
  notify?: boolean;
}

export interface RejectBookingBody {
  reason: BookingRejectReason;
  message?: string | null;
  /** По умолчанию — вся оплаченная сумма. */
  refundAmount?: number | null;
  /** Возврат уже выполнен вручную — сразу refund.status='done'. */
  refundDone?: boolean;
  notify?: boolean;
}

export const BOOKING_REJECT_REASONS: { value: BookingRejectReason; label: string }[] = [
  { value: 'no_availability', label: 'Нет мест на эти даты' },
  { value: 'price_changed', label: 'Цена изменилась' },
  { value: 'data_error', label: 'Ошибка в данных' },
  { value: 'other', label: 'Другое' },
];

/* ── Ошибки ───────────────────────────────────────────────────────────── */

export const ROOMS_ERROR_MESSAGES: Record<string, string> = {
  custom_rooms_not_migrated: 'Модуль Room Type не настроен на сервере (миграция)',
  hotel_id_invalid: 'Не указан отель',
  source_room_id_invalid: 'Не указан номер-источник',
  source_room_not_found: 'Номер-источник не найден в выдаче',
  operator_required: 'Выберите хотя бы одно предложение оператора',
  name_required: 'Укажите название Room Type',
  area_invalid: 'Площадь должна быть числом',
  pricing_mode_invalid: 'Выберите режим цены: фиксированная или правило от цены Level.Travel',
  fixed_price_invalid: 'Укажите фиксированную цену больше нуля',
  fixed_price_out_of_range: 'Фиксированная цена не может быть больше 100 000 000 ₽',
  operator_id_invalid: 'ID оператора должен быть целым положительным числом (или оставьте пустым)',
  exclusive_scope_invalid: 'Неверная область действия флага',
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

/** Ошибки бронирований (`/bookings/*`) — переопределяют общие коды, где смысл другой. */
export const BOOKING_ERROR_MESSAGES: Record<string, string> = {
  not_found: 'Бронирование не найдено',
  invalid_status: 'Действие недоступно для текущего статуса бронирования — обновите страницу',
  reason_invalid: 'Выберите причину отклонения',
  refund_amount_invalid: 'Сумма возврата должна быть от 0 до оплаченной суммы',
  voucher_required: 'Сначала загрузите ваучер (PDF)',
  file_required: 'Выберите PDF-файл ваучера',
  file_too_large: 'Файл ваучера больше 10 МБ',
  file_invalid: 'Допустим только PDF',
  file_type_invalid: 'Допустим только PDF',
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

// POST /room-types/preview-price — v2: { pricingMode, rule?, fixedPrice?, fixedPriceUnit?, offers?, nights? }
export function previewPrice(body: PreviewPriceBody): Promise<PreviewResult> {
  const payload: Record<string, unknown> = { pricingMode: body.pricingMode, offers: body.offers || [] };
  if (body.pricingMode === 'rule') payload.rule = body.rule;
  else {
    payload.fixedPrice = body.fixedPrice;
    payload.fixedPriceUnit = body.fixedPriceUnit || 'total';
    if (body.nights) payload.nights = body.nights;
  }
  return request<PreviewResult>('/room-types/preview-price', { method: 'POST', body: JSON.stringify(payload) }, 'Не удалось рассчитать цену');
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

// GET /diagnostics?recheck=1 — работает и когда модуль DISABLED (миграция не выполнена)
export function getDiagnostics(recheck = false): Promise<Diagnostics> {
  return request<Diagnostics>(`/diagnostics${qs({ recheck })}`, {}, 'Не удалось получить диагностику');
}

/* ── Бронирования (без Level.Travel) ──────────────────────────────────── */

/** Тот же request, но коды ошибок — с подписями бронирований. */
async function bookingRequest<T>(path: string, init: RequestInit = {}, fallback = 'Ошибка запроса'): Promise<T> {
  try {
    return await request<T>(`/bookings${path}`, init, fallback);
  } catch (e) {
    if (e instanceof RoomsApiError && BOOKING_ERROR_MESSAGES[e.code]) {
      throw new RoomsApiError(e.status, e.code, BOOKING_ERROR_MESSAGES[e.code]);
    }
    throw e;
  }
}

// GET /bookings?status&hotel_id&operator&q&from&to&page&limit → { items, total, page, limit, summary }
export function listBookings(params: BookingsListParams = {}): Promise<BookingsListResult> {
  return bookingRequest<BookingsListResult>(qs(params), {}, 'Не удалось загрузить бронирования');
}

// GET /bookings/summary → { summary }
export async function getBookingsSummary(): Promise<BookingsSummary> {
  const data = await bookingRequest<{ summary: BookingsSummary }>('/summary', {}, 'Не удалось загрузить сводку бронирований');
  return data.summary;
}

// GET /bookings/:id → { booking, roomType, events, order }
export function getBooking(id: number): Promise<BookingDetails> {
  return bookingRequest<BookingDetails>(`/${id}`, {}, 'Не удалось загрузить бронирование');
}

// POST /bookings/:id/confirm { hotelBookingRef?, clientMessage?, notify } — только из pending_confirmation
export async function confirmBooking(id: number, body: ConfirmBookingBody): Promise<Booking> {
  const data = await bookingRequest<{ ok: boolean; booking: Booking }>(`/${id}/confirm`, { method: 'POST', body: JSON.stringify(body) }, 'Не удалось подтвердить бронирование');
  return data.booking;
}

// POST /bookings/:id/reject { reason, message?, refundAmount?, refundDone?, notify } — из pending_confirmation
export async function rejectBooking(id: number, body: RejectBookingBody): Promise<Booking> {
  const data = await bookingRequest<{ ok: boolean; booking: Booking }>(`/${id}/reject`, { method: 'POST', body: JSON.stringify(body) }, 'Не удалось отклонить бронирование');
  return data.booking;
}

// POST /bookings/:id/cancel — то же для уже подтверждённого (confirmed → cancelled)
export async function cancelBooking(id: number, body: RejectBookingBody): Promise<Booking> {
  const data = await bookingRequest<{ ok: boolean; booking: Booking }>(`/${id}/cancel`, { method: 'POST', body: JSON.stringify(body) }, 'Не удалось отменить бронирование');
  return data.booking;
}

// POST /bookings/:id/refund-done { amount?, notify } — только при refund.status='pending'
export async function bookingRefundDone(id: number, amount?: number | null, notify = true): Promise<Booking> {
  const body: Record<string, unknown> = { notify };
  if (amount !== undefined && amount !== null) body.amount = amount;
  const data = await bookingRequest<{ ok: boolean; booking: Booking }>(`/${id}/refund-done`, { method: 'POST', body: JSON.stringify(body) }, 'Не удалось отметить возврат');
  return data.booking;
}

// POST /bookings/:id/comment { text } — комментарий для сотрудников (клиенту не виден)
export async function commentBooking(id: number, text: string): Promise<Booking> {
  const data = await bookingRequest<{ ok: boolean; booking: Booking }>(`/${id}/comment`, { method: 'POST', body: JSON.stringify({ text }) }, 'Не удалось сохранить комментарий');
  return data.booking;
}

// POST /bookings/:id/voucher (multipart `voucher`, PDF ≤ 10 МБ) — до или после подтверждения
export async function uploadBookingVoucher(id: number, file: File): Promise<Booking> {
  const form = new FormData();
  form.append('voucher', file, file.name);
  const data = await bookingRequest<{ ok: boolean; booking: Booking }>(`/${id}/voucher`, { method: 'POST', body: form }, 'Не удалось загрузить ваучер');
  return data.booking;
}

// POST /bookings/:id/resend-voucher — письмо с ваучером + push (только confirmed с ваучером)
export async function resendBookingVoucher(id: number): Promise<{ booking: Booking; result?: { sent?: boolean; error?: string } }> {
  const data = await bookingRequest<{ ok: boolean; booking: Booking; result?: { sent?: boolean; error?: string } }>(`/${id}/resend-voucher`, { method: 'POST', body: JSON.stringify({}) }, 'Не удалось отправить ваучер');
  return { booking: data.booking, result: data.result };
}

/* ── Хелперы ──────────────────────────────────────────────────────────── */

/** Абсолютный URL фото: свои (`/uploads/rooms/…`) лежат на totus_API, LT — по полной ссылке. */
export function imageUrl(url: string | null | undefined): string {
  if (!url) return '';
  if (/^https?:\/\//i.test(url) || url.startsWith('data:')) return url;
  return `${API_BASE_URL.replace(/\/+$/, '')}${url.startsWith('/') ? '' : '/'}${url}`;
}

/** «−10 %», «+1 500 ₽» — как ruleLabel на сервере (для списка, где label не отдаётся). */
export function ruleLabel(rule: { ruleType: RuleType | null; ruleValue: number | null } | null | undefined): string {
  if (!rule || !rule.ruleType) return '—';
  const value = Number(rule.ruleValue) || 0;
  const sign = value > 0 ? '+' : value < 0 ? '−' : '';
  const abs = Math.abs(value);
  return rule.ruleType === 'percent' ? `${sign}${abs} %` : `${sign}${formatNumber(Math.round(abs))} ₽`;
}

/** «1 ₽ (фикс.)», «1 500 ₽/ночь (фикс.)» — как pricingLabel на сервере. */
export function fixedPriceLabel(fixedPrice: number | null | undefined, unit?: FixedPriceUnit | null): string {
  if (fixedPrice === null || fixedPrice === undefined || !Number.isFinite(Number(fixedPrice))) return '— (фикс.)';
  return `${formatMoney(Number(fixedPrice))}${unit === 'per_night' ? '/ночь' : ''} (фикс.)`;
}

/** Подпись цены Room Type: pricingLabel с сервера, иначе fixed → «1 ₽ (фикс.)», rule → «−10 %». */
export function pricingLabelOf(rt: Pick<RoomType, 'pricingMode' | 'fixedPrice' | 'fixedPriceUnit' | 'rule' | 'ruleType' | 'ruleValue'> & { pricingLabel?: string | null; ruleLabel?: string | null }): string {
  if (rt.pricingLabel) return rt.pricingLabel;
  if (rt.pricingMode === 'fixed') return fixedPriceLabel(rt.fixedPrice, rt.fixedPriceUnit);
  return rt.ruleLabel || ruleLabel(rt.rule || { ruleType: rt.ruleType, ruleValue: rt.ruleValue });
}

/** §2.3: «Только наши» / «Только наши · весь отель»; null — флаг выключен. */
export function exclusiveLabel(rt: Pick<RoomType, 'exclusive' | 'exclusiveScope'> | null | undefined): string | null {
  if (!rt?.exclusive) return null;
  return rt.exclusiveScope === 'hotel' ? 'Только наши · весь отель' : 'Только наши';
}

/** §2.3: закрыт ли номер отеля для Level.Travel по сводке `exclusive` из GET /hotels/:id/rooms. */
export function isRoomExclusive(exclusive: HotelExclusive | null | undefined, roomId: number | null | undefined): boolean {
  if (!exclusive?.active || roomId === null || roomId === undefined) return false;
  if (exclusive.scope === 'hotel') return true;
  return (exclusive.rooms || []).map(Number).includes(Number(roomId));
}

/** Текст правила из слепка price-log/заказа: label с сервера, иначе собираем из mode/fixedPrice или type/value. */
export function snapshotLabel(rule: PriceRuleSnapshot | null | undefined): string {
  if (rule?.label) return rule.label;
  if (rule?.mode === 'fixed') return fixedPriceLabel(rule.fixedPrice, rule.unit);
  if (rule?.type && rule.value !== undefined && rule.value !== null) return ruleLabel({ ruleType: rule.type, ruleValue: Number(rule.value) });
  return '—';
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

/**
 * Предложения-шаблоны номера, как их выберет витрина (v2): mealTypes заданы — самое дешёвое по каждому
 * указанному питанию, иначе одно самое дешёвое предложение номера. Оператор шаблона не важен.
 */
export function templateOffers<T extends { meal: string; price: number }>(offers: T[], mealTypes: string[] | null | undefined): T[] {
  const sorted = [...offers].filter((o) => Number.isFinite(Number(o.price))).sort((a, b) => Number(a.price) - Number(b.price));
  if (!mealTypes || !mealTypes.length) return sorted.length ? [sorted[0]] : [];
  const wanted = mealTypes.map((m) => String(m).toUpperCase());
  const byMeal = new Map<string, T>();
  sorted.forEach((o) => {
    const meal = String(o.meal || '').toUpperCase();
    if (wanted.includes(meal) && !byMeal.has(meal)) byMeal.set(meal, o);
  });
  return [...byMeal.values()];
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
