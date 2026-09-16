'use client';

// Общие справочники, форматирование и мелкие UI-примитивы раздела «Отели и номера».
// Базовые примитивы форм/модалов берём из components/notifications/shared (Modal, Toggle, Field…).

import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import Icon from '@/components/Icon';
import { t, radius, text, button, badge } from '@/lib/theme';
import type { BadgeTone } from '@/components/notifications/shared';
import { exclusiveLabel, formatMoney, pricingLabelOf, type ChangeLogItem, type RoomType, type RoomTypeStatus } from '@/lib/rooms-api';

/* ── Справочники ────────────────────────────────────────────────────── */

export type ListStatus = RoomTypeStatus | 'never_seen' | 'skipped';

export const STATUS_META: Record<ListStatus, { label: string; tone: BadgeTone }> = {
    fixed: { label: 'Активен · фикс. цена', tone: 'success' },
    replacing: { label: 'Активен', tone: 'success' },
    inactive: { label: 'Выкл', tone: 'neutral' },
    source_missing: { label: 'Источник не найден', tone: 'warning' },
    no_offers: { label: 'Нет предложений у номера', tone: 'warning' },
    no_pricing: { label: 'Цена не задана', tone: 'error' },
    margin_clamped: { label: 'Маржа ограничена', tone: 'error' },
    never_seen: { label: 'Ещё не показывался', tone: 'neutral' },
    skipped: { label: 'Пропущен на витрине', tone: 'warning' },
};

/** Причина последнего пропуска на витрине актуальна, если проверка была позже последнего показа (или показов не было). */
export function activeSkipReason(rt: RoomType): string | null {
    const reason = rt.lastSkipReason || rt.last?.skipReason || null;
    if (!reason) return null;
    const checked = rt.lastCheckedAt || rt.last?.checkedAt || null;
    const seen = rt.last?.seenAt || null;
    if (seen && checked && new Date(checked).getTime() < new Date(seen).getTime()) return null;
    return reason;
}

/** Причина пропуска по-русски: `source_room_missing (source 501; ids in result: …)` → «номер-источник не найден в выдаче (…)». */
export function skipReasonText(reason: string | null | undefined): string {
    if (!reason) return '';
    const m = /^([a-z_]+)\s*(\(.*\))?$/.exec(reason.trim());
    const code = m ? m[1] : reason;
    const detail = m && m[2] ? ` ${m[2]}` : '';
    const names: Record<string, string> = {
        no_pricing: 'цена или правило не заданы',
        search_type: 'не совпал тип поиска',
        source_room_missing: 'номер-источник не найден в выдаче Level.Travel',
        no_offers: 'у номера-источника нет подходящих предложений',
        no_priced_offers: 'у предложений номера нет цены',
        offer_map_failed: 'не удалось сохранить карту предложений (ошибка БД)',
    };
    return `${names[code] || code}${detail}`;
}

/**
 * Статус для карточек и списка. Выключенный — всегда «Выкл» (backend тоже отдаёт 'inactive');
 * по выдаче (GET /hotels/:id/rooms) — `status` сервера; в списке (GET /room-types) — по `last`:
 * активный без показов — «Ещё не показывался», не «Источник не найден»; если последняя проверка на витрине
 * закончилась пропуском (lastSkipReason новее lastSeenAt) — «Пропущен на витрине» с причиной.
 */
export function roomTypeStatus(rt: RoomType): ListStatus {
    if (!rt.active) return 'inactive';
    if (rt.status) return rt.status;
    if (activeSkipReason(rt)) return 'skipped';
    if (!rt.last?.seenAt) return 'never_seen';
    if (rt.pricingMode === 'fixed') return 'fixed';
    if (rt.last?.marginClamped) return 'margin_clamped';
    return 'replacing';
}

/** §2.3: «Только наши» / «Только наши · весь отель»; null — флаг выключен. */
export function exclusiveBadgeLabel(rt: Pick<RoomType, 'exclusive' | 'exclusiveScope'> | null | undefined): string | null {
    return exclusiveLabel(rt);
}

/** §2.3: пояснение под бейджем — что именно скрыто. */
export function exclusiveText(rt: Pick<RoomType, 'exclusive' | 'exclusiveScope'> | null | undefined): string {
    if (!rt?.exclusive) return '';
    return rt.exclusiveScope === 'hotel'
        ? 'Продаются только наши предложения — Level.Travel скрыт во всём отеле'
        : 'Продаются только наши предложения — Level.Travel скрыт в этом номере';
}

/** Подпись статуса на карточке под номером. */
export function statusText(rt: RoomType): string {
    const status = roomTypeStatus(rt);
    const replaces = rt.operatorIds?.length ? ` · замещает предложения ${rt.operatorNames?.length ? rt.operatorNames.join(', ') : `оператора ${rt.operatorIds.join(', ')}`}` : '';
    const only = rt.exclusive ? ` · только наши предложения (Level.Travel скрыт ${rt.exclusiveScope === 'hotel' ? 'во всём отеле' : 'в этом номере'})` : '';
    if (status === 'fixed') return `Показывается у номера как ${rt.operatorName || 'Arlekino'} · фиксированная цена${replaces}${only}`;
    if (status === 'replacing') return `Показывается у номера как ${rt.operatorName || 'Arlekino'} · цена по правилу${replaces}${only}`;
    if (status === 'source_missing') return 'Источник не найден на эти даты';
    if (status === 'no_offers') return 'Номер есть в выдаче, но предложений нет — комната не показывается';
    if (status === 'no_pricing') return 'Цена или правило не заданы — откройте «Изменить» и сохраните цену';
    if (status === 'margin_clamped') return 'Маржа ограничена минимальным порогом';
    if (status === 'skipped') return `На витрине пропущен: ${skipReasonText(activeSkipReason(rt))}`;
    if (status === 'never_seen') return 'Ещё не показывался на витрине';
    return 'Выключен — на витрине не показывается';
}

export const MEAL_NAMES: Record<string, string> = {
    RO: 'без питания',
    BB: 'завтрак',
    HB: 'полупансион',
    FB: 'полный пансион',
    AI: 'всё включено',
    UAI: 'ультра всё включено',
};

export function mealLabel(meal: string | null | undefined): string {
    if (!meal) return '—';
    const name = MEAL_NAMES[meal.toUpperCase()];
    return name ? `${meal} · ${name}` : meal;
}

export function plural(n: number, one: string, few: string, many: string): string {
    const abs = Math.abs(n) % 100;
    const last = abs % 10;
    if (abs > 10 && abs < 20) return many;
    if (last > 1 && last < 5) return few;
    if (last === 1) return one;
    return many;
}

/** «1 ₽ (фикс.)» / «1 500 ₽/ночь (фикс.)» / «−10 %». */
export function roomTypeLabel(rt: RoomType): string {
    return pricingLabelOf(rt);
}

/** Как считается цена — для колонок/чипов: «фикс.» / «правило». */
export function pricingModeLabel(rt: Pick<RoomType, 'pricingMode'>): string {
    return rt.pricingMode === 'fixed' ? 'Фиксированная цена' : 'Правило от цены Level.Travel';
}

/* ── Даты ────────────────────────────────────────────────────────────── */

const MONTHS = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];

export function addDays(iso: string, days: number): Date {
    const d = new Date(`${iso}T00:00:00`);
    d.setDate(d.getDate() + days);
    return d;
}

/** «12–19 окт 2026» из даты заезда и ночей. */
export function formatDateRange(startDate: string | null | undefined, nights: number | string | null | undefined): string {
    if (!startDate) return '—';
    const start = new Date(`${startDate}T00:00:00`);
    if (Number.isNaN(start.getTime())) return startDate;
    const n = Number(nights) || 0;
    const end = addDays(startDate, n);
    const sameMonth = start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear();
    if (!n) return `${start.getDate()} ${MONTHS[start.getMonth()]} ${start.getFullYear()}`;
    if (sameMonth) return `${start.getDate()}–${end.getDate()} ${MONTHS[end.getMonth()]} ${end.getFullYear()}`;
    return `${start.getDate()} ${MONTHS[start.getMonth()]} – ${end.getDate()} ${MONTHS[end.getMonth()]} ${end.getFullYear()}`;
}

/** «12–19 окт 2026 · 7 ночей · 2 взр. · вылет Москва». */
export function searchSummary(p: { start_date?: string | null; nights?: string | number | null; adults?: string | number | null; kids?: string | number | null; from_city?: string | null }): string {
    const parts = [formatDateRange(p.start_date, p.nights)];
    const n = Number(p.nights) || 0;
    if (n) parts.push(`${n} ${plural(n, 'ночь', 'ночи', 'ночей')}`);
    const a = Number(p.adults) || 0;
    if (a) parts.push(`${a} взр.${Number(p.kids) ? ` + ${Number(p.kids)} дет.` : ''}`);
    if (p.from_city) parts.push(`вылет ${p.from_city}`);
    return parts.join(' · ');
}

export function formatDateTime(value?: string | null): string {
    if (!value) return '—';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return value;
    return d.toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function formatShortDateTime(value?: string | null): string {
    if (!value) return '—';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return value;
    return d.toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

/** «2 мин назад», «вчера», «—». */
export function timeAgo(value?: string | null): string {
    if (!value) return '—';
    const ms = Date.now() - new Date(value).getTime();
    if (!Number.isFinite(ms)) return value;
    const min = Math.round(ms / 60000);
    if (min < 1) return 'только что';
    if (min < 60) return `${min} мин назад`;
    const h = Math.round(min / 60);
    if (h < 24) return `${h} ч назад`;
    const d = Math.round(h / 24);
    if (d === 1) return 'вчера';
    if (d < 30) return `${d} ${plural(d, 'день', 'дня', 'дней')} назад`;
    return formatDateTime(value);
}

/** Текст записи истории правок из `changes` JSON. */
export function describeChange(item: ChangeLogItem): string {
    const c = item.changes || {};
    if (c.created) return `создан · цена ${String(c.pricing || c.rule || '')}${Array.isArray(c.operators) && (c.operators as unknown[]).length ? ` · замещает операторов ${(c.operators as unknown[]).join(', ')}` : ''}${c.exclusive ? ' · только наши предложения (Level.Travel скрыт)' : ''}`;
    if (c.deleted) return `удалён${c.name ? ` («${String(c.name)}»)` : ''}`;
    if (c.duplicatedFrom) return `создан как копия Room Type #${String(c.duplicatedFrom)}`;
    const names: Record<string, string> = {
        ruleType: 'тип правила', ruleValue: 'значение правила', rounding: 'округление', minPrice: 'мин. цена', maxPrice: 'макс. цена',
        minMarginType: 'тип мин. маржи', minMarginValue: 'мин. маржа', badge: 'бейдж', active: 'активность', sortOrder: 'порядок',
        packageTypes: 'тип пакета', operatorIds: 'замещаемые операторы', mealTypes: 'питание',
        pricingMode: 'режим цены', fixedPrice: 'фиксированная цена', fixedPriceUnit: 'единица фикс. цены', operatorName: 'название оператора', operatorId: 'ID оператора',
        exclusive: 'только наши предложения (Level.Travel скрыт)', exclusiveScope: 'область «только наши предложения»',
        'content.nameRu': 'название RU', 'content.nameEn': 'название EN', 'content.accommodation': 'размещение', 'content.area': 'площадь',
        'content.view': 'вид', 'content.description': 'описание', 'content.facilities': 'удобства', 'content.images': 'фотографии',
    };
    const fmt = (v: unknown): string => {
        if (v === null || v === undefined || v === '') return '—';
        if (typeof v === 'boolean') return v ? 'вкл' : 'выкл';
        if (v === 'fixed') return 'фиксированная';
        if (v === 'rule') return 'правило';
        if (v === 'per_night') return 'за ночь';
        if (v === 'total') return 'за проживание';
        if (v === 'room') return 'только этот номер';
        if (v === 'hotel') return 'весь отель';
        if (Array.isArray(v)) return v.length > 3 ? `${v.length} эл.` : v.map((x) => (typeof x === 'object' ? (x as { name?: string })?.name || '…' : String(x))).join(', ');
        if (typeof v === 'object') return '…';
        const s = String(v);
        return s.length > 40 ? `${s.slice(0, 40)}…` : s;
    };
    const parts = Object.entries(c).map(([key, value]) => {
        const label = names[key] || key;
        const v = value as { from?: unknown; to?: unknown } | undefined;
        if (v && typeof v === 'object' && ('from' in v || 'to' in v)) return `${label} ${fmt(v.from)} → ${fmt(v.to)}`;
        return `${label}: ${fmt(value)}`;
    });
    return parts.join(' · ') || 'изменение';
}

/* ── Хуки ────────────────────────────────────────────────────────────── */

export function useDebounced<T>(value: T, delay = 400): T {
    const [debounced, setDebounced] = useState(value);
    useEffect(() => {
        const id = setTimeout(() => setDebounced(value), delay);
        return () => clearTimeout(id);
    }, [value, delay]);
    return debounced;
}

/* ── Примитивы ───────────────────────────────────────────────────────── */

export function Stars({ count, size = 14 }: { count: number; size?: number }) {
    const n = Math.max(0, Math.min(5, Math.round(count)));
    if (!n) return null;
    return (
        <span aria-label={`${n} звёзд`} style={{ color: t.accent, fontSize: size, lineHeight: 1, letterSpacing: 1, whiteSpace: 'nowrap' }}>
            {'★'.repeat(n)}
        </span>
    );
}

export function RatingBadge({ value }: { value: number | null | undefined }) {
    if (!value) return null;
    return (
        <span style={{ ...badge('success'), padding: '2px 8px', fontSize: 12 }}>
            {String(value).replace('.', ',')}
        </span>
    );
}

/** Плейсхолдер/миниатюра фото. */
export function Thumb({ src, width, height, radiusPx = radius.md, alt = '' }: { src?: string | null; width: number; height: number; radiusPx?: number; alt?: string }) {
    const box: CSSProperties = {
        width,
        height,
        borderRadius: radiusPx,
        background: t.surfaceInset,
        border: `1px solid ${t.border}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: t.textTertiary,
        flexShrink: 0,
        overflow: 'hidden',
    };
    if (src) {
        // eslint-disable-next-line @next/next/no-img-element
        return <img src={src} alt={alt} style={{ ...box, display: 'block', objectFit: 'cover' }} />;
    }
    return (
        <div style={box} aria-hidden>
            <Icon name="photo" size={Math.min(28, Math.round(height / 3))} />
        </div>
    );
}

/** Вкладки-чипы (как в «Уведомлениях»). */
export function TabPills<T extends string>({ tabs, value, onChange }: { tabs: { value: T; label: string }[]; value: T; onChange: (v: T) => void }) {
    return (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {tabs.map((item) => {
                const active = value === item.value;
                return (
                    <button
                        key={item.value}
                        type="button"
                        onClick={() => onChange(item.value)}
                        aria-current={active ? 'page' : undefined}
                        style={{
                            ...button('secondary', 'sm'),
                            borderRadius: radius.pill,
                            background: active ? t.accentSoft : t.surfaceInset,
                            border: `1px solid ${active ? t.accentBorder : t.border}`,
                            color: active ? t.accent : t.textTertiary,
                        }}
                    >
                        {item.label}
                    </button>
                );
            })}
        </div>
    );
}

/** Сегментированный переключатель («Процент % / Сумма ₽», «1 ₽ / 10 ₽ / 100 ₽»). */
export function Segment<T extends string | number>({ options, value, onChange, disabled, fullWidth }: { options: { value: T; label: ReactNode }[]; value: T; onChange: (v: T) => void; disabled?: boolean; fullWidth?: boolean }) {
    return (
        <div
            role="radiogroup"
            style={{
                display: fullWidth ? 'grid' : 'inline-grid',
                gridTemplateColumns: `repeat(${options.length}, 1fr)`,
                gap: 2,
                padding: 3,
                borderRadius: radius.sm,
                background: t.surfaceInset,
                border: `1px solid ${t.border}`,
                opacity: disabled ? 0.5 : 1,
            }}
        >
            {options.map((o) => {
                const active = o.value === value;
                return (
                    <button
                        key={String(o.value)}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        disabled={disabled}
                        onClick={() => onChange(o.value)}
                        style={{
                            padding: '7px 14px',
                            borderRadius: radius.sm - 2,
                            border: 'none',
                            background: active ? t.surface : 'transparent',
                            boxShadow: active ? t.shadowCard : 'none',
                            color: active ? t.textPrimary : t.textSecondary,
                            fontSize: 13,
                            fontWeight: 600,
                            fontFamily: 'inherit',
                            cursor: disabled ? 'not-allowed' : 'pointer',
                            whiteSpace: 'nowrap',
                        }}
                    >
                        {o.label}
                    </button>
                );
            })}
        </div>
    );
}

/** Чип-фильтр с состоянием (звёзды, удобства). */
export function Chip({ active, onClick, children, onRemove, title }: { active?: boolean; onClick?: () => void; children: ReactNode; onRemove?: () => void; title?: string }) {
    return (
        <span
            role={onClick ? 'button' : undefined}
            onClick={onClick}
            title={title}
            style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 12px',
                borderRadius: radius.pill,
                border: `1px solid ${active ? t.accentBorder : t.border}`,
                background: active ? t.accentSoft : t.surface,
                color: active ? t.accent : t.textSecondary,
                fontSize: 13,
                fontWeight: 600,
                lineHeight: '18px',
                cursor: onClick ? 'pointer' : 'default',
                userSelect: 'none',
                whiteSpace: 'nowrap',
            }}
        >
            {children}
            {onRemove ? (
                <button
                    type="button"
                    onClick={(e) => {
                        e.stopPropagation();
                        onRemove();
                    }}
                    aria-label="Удалить"
                    style={{ border: 'none', background: 'transparent', padding: 0, color: 'inherit', cursor: 'pointer', display: 'inline-flex' }}
                >
                    <Icon name="close" size={14} />
                </button>
            ) : null}
        </span>
    );
}

/** Служебная пометка Room Type в админке (на витрине не показывается). */
export function BrandBadge({ label }: { label?: string | null }) {
    return (
        <span title="Служебная пометка, на витрине не показывается" style={{ ...badge('accent'), padding: '3px 10px' }}>
            <span aria-hidden style={{ width: 6, height: 6, borderRadius: radius.pill, background: t.accent, display: 'inline-block' }} />
            {label || 'Totus'}
        </span>
    );
}

/** §2.3: «Только наши» / «Только наши · весь отель» — у Room Type с флагом «продавать только наши предложения». */
export function ExclusiveBadge({ rt }: { rt: Pick<RoomType, 'exclusive' | 'exclusiveScope'> }) {
    const label = exclusiveBadgeLabel(rt);
    if (!label) return null;
    return (
        <span title={exclusiveText(rt)} style={{ ...badge('warning'), padding: '3px 10px' }}>
            {label}
        </span>
    );
}

/** Пустое состояние списка. */
export function Empty({ title, hint, action }: { title: string; hint?: string; action?: ReactNode }) {
    return (
        <div style={{ padding: '40px 24px', textAlign: 'center', border: `1px dashed ${t.border}`, borderRadius: radius.md, background: t.surfaceInset }}>
            <div style={{ ...text.cardTitle, marginBottom: 6 }}>{title}</div>
            {hint ? <div style={{ ...text.caption, marginBottom: action ? 16 : 0 }}>{hint}</div> : null}
            {action}
        </div>
    );
}

export function Spinner({ label }: { label?: string }) {
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '16px 0', color: t.textSecondary, fontSize: 14 }}>
            <span
                aria-hidden
                style={{ width: 16, height: 16, borderRadius: radius.pill, border: `2px solid ${t.border}`, borderTopColor: t.accent, animation: 'totus-spin 0.8s linear infinite', flexShrink: 0 }}
            />
            <style>{'@keyframes totus-spin { to { transform: rotate(360deg); } }'}</style>
            <span>{label || 'Загрузка...'}</span>
        </div>
    );
}

/** Строка «Провайдер 96 500 ₽ → Наша 86 850 ₽ · Маржа −9 650 ₽»; v2 fixed — «Наша 1 ₽ (фикс.)». */
export function PricePair({ provider, final, margin, compact, fixed, perNight }: { provider: number | null | undefined; final: number | null | undefined; margin?: number | null; compact?: boolean; fixed?: boolean; perNight?: boolean }) {
    const m = margin === undefined ? (provider != null && final != null ? final - provider : null) : margin;
    return (
        <div style={{ textAlign: 'right', minWidth: compact ? 0 : 200 }}>
            <div style={{ fontSize: compact ? 13 : 14, color: t.textSecondary, whiteSpace: 'nowrap' }}>
                {fixed ? 'Цена LT' : 'Провайдер'} <span style={{ color: t.textPrimary }}>{formatMoney(provider)}</span>
                <span style={{ margin: '0 6px', color: t.textTertiary }}>→</span>
                <span style={{ fontWeight: 700, color: t.textPrimary, fontSize: compact ? 14 : 16 }}>Наша {formatMoney(final)}{fixed ? `${perNight ? '/ночь' : ''} (фикс.)` : ''}</span>
            </div>
            <div style={{ fontSize: 12, marginTop: 2, color: m == null ? t.textTertiary : m < 0 ? t.error : t.success, whiteSpace: 'nowrap' }}>
                Маржа {formatMoney(m, true)}
            </div>
        </div>
    );
}

/* ── Таблицы ─────────────────────────────────────────────────────────── */

export const tableStyle: CSSProperties = { width: '100%', borderCollapse: 'collapse', fontSize: 13 };
export const thStyle: CSSProperties = {
    textAlign: 'left',
    padding: '10px 12px',
    fontSize: 12,
    fontWeight: 600,
    color: t.textTertiary,
    borderBottom: `1px solid ${t.border}`,
    background: t.surfaceInset,
    whiteSpace: 'nowrap',
};
export const tdStyle: CSSProperties = { padding: '10px 12px', borderBottom: `1px solid ${t.border}`, color: t.textPrimary, verticalAlign: 'middle' };
export const tdRight: CSSProperties = { ...tdStyle, textAlign: 'right', whiteSpace: 'nowrap' };
export const thRight: CSSProperties = { ...thStyle, textAlign: 'right' };

export function TableWrap({ children }: { children: ReactNode }) {
    return <div style={{ overflowX: 'auto', border: `1px solid ${t.border}`, borderRadius: radius.md }}>{children}</div>;
}

/** Ссылка-крошка «Отели › Rixos». */
export function Breadcrumbs({ items }: { items: { label: string; onClick?: () => void }[] }) {
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: t.textSecondary, flexWrap: 'wrap' }}>
            {items.map((item, i) => (
                <span key={`${item.label}-${i}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    {i > 0 ? <Icon name="chevronRight" size={14} style={{ color: t.textTertiary }} /> : null}
                    {item.onClick ? (
                        <button type="button" onClick={item.onClick} style={{ border: 'none', background: 'transparent', padding: 0, color: t.accent, fontSize: 13, fontFamily: 'inherit', cursor: 'pointer' }}>
                            {item.label}
                        </button>
                    ) : (
                        <span style={{ color: t.textPrimary }}>{item.label}</span>
                    )}
                </span>
            ))}
        </div>
    );
}

/** Подтверждение опасного действия (без window.confirm — в стиле админки). */
export function ConfirmDialog({ title, message, confirmLabel = 'Удалить', busy, onConfirm, onClose }: { title: string; message: ReactNode; confirmLabel?: string; busy?: boolean; onConfirm: () => void; onClose: () => void }) {
    return (
        <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0, 0, 0, 0.45)', zIndex: 120, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
            <div role="alertdialog" aria-modal aria-label={title} onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 420, background: t.surface, border: `1px solid ${t.border}`, borderRadius: radius.lg, boxShadow: t.shadowRaised, padding: 24 }}>
                <h3 style={{ ...text.sectionTitle, margin: '0 0 8px' }}>{title}</h3>
                <div style={{ ...text.body, marginBottom: 20 }}>{message}</div>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                    <button type="button" onClick={onClose} style={button('secondary', 'md')}>Отмена</button>
                    <button type="button" onClick={onConfirm} disabled={busy} style={{ ...button('danger', 'md'), opacity: busy ? 0.6 : 1 }}>
                        {busy ? 'Удаляем...' : confirmLabel}
                    </button>
                </div>
            </div>
        </div>
    );
}
