'use client';

// Статус бронирования наших Room Type (без Level.Travel) + мелкие хелперы,
// общие для вкладки «Бронирования» и карточки /rooms/booking/[id].

import Icon, { type IconName } from '@/components/Icon';
import { badge } from '@/lib/theme';
import type { BadgeTone } from '@/components/notifications/shared';
import { formatMoney, type Booking, type BookingEvent, type BookingStatus, type BookingTourist } from '@/lib/rooms-api';
import { formatDateTime, formatShortDateTime, plural } from './shared';

/* ── Справочники ──────────────────────────────────────────────────────── */

export const BOOKING_STATUS_META: Record<BookingStatus, { label: string; short: string; tone: BadgeTone; icon: IconName }> = {
    pending_payment: { label: 'Ожидает оплаты', short: 'Не оплачено', tone: 'neutral', icon: 'info' },
    pending_confirmation: { label: 'Ожидает подтверждения', short: 'Ожидает подтв.', tone: 'warning', icon: 'calendar' },
    confirmed: { label: 'Подтверждено', short: 'Подтверждено', tone: 'success', icon: 'check' },
    rejected: { label: 'Отклонено', short: 'Отклонено', tone: 'error', icon: 'close' },
    cancelled: { label: 'Отменено', short: 'Отменено', tone: 'error', icon: 'close' },
};

export function bookingStatusMeta(status: BookingStatus | string) {
    return BOOKING_STATUS_META[status as BookingStatus] || { label: String(status), short: String(status), tone: 'neutral' as BadgeTone, icon: 'info' as IconName };
}

/** Плашка статуса: «Ожидает подтв.» (жёлтая) / «Подтверждено» / «Отклонено» / «Возврат выполнен» (серая). */
export default function BookingStatusBadge({ booking, size = 'sm' }: { booking: Pick<Booking, 'status' | 'refund'>; size?: 'sm' | 'md' }) {
    // Отклонённое/отменённое с выполненным возвратом — серый «Возврат выполнен» (как в макете списка).
    const refunded = (booking.status === 'rejected' || booking.status === 'cancelled') && booking.refund?.status === 'done';
    const meta = bookingStatusMeta(booking.status);
    const label = refunded ? 'Возврат выполнен' : size === 'sm' ? meta.short : meta.label;
    const tone: BadgeTone = refunded ? 'neutral' : meta.tone;
    return (
        <span style={{ ...badge(tone), fontSize: size === 'sm' ? 11 : 12, padding: size === 'sm' ? '3px 10px' : '4px 12px', whiteSpace: 'nowrap' }}>
            {size === 'md' ? <Icon name={meta.icon} size={14} /> : null}
            {label}
        </span>
    );
}

/** Плашка оплаты в списке: «Оплачено» / «Ожидает» / «Возврат» / «Возвращено». */
export function PaymentBadge({ booking }: { booking: Pick<Booking, 'paymentStatus'> }) {
    const map: Record<string, { label: string; tone: BadgeTone }> = {
        pending: { label: 'Ожидает', tone: 'neutral' },
        paid: { label: 'Оплачено', tone: 'success' },
        failed: { label: 'Не прошла', tone: 'error' },
        refund_pending: { label: 'Возврат', tone: 'warning' },
        refunded: { label: 'Возвращено', tone: 'neutral' },
        partially_refunded: { label: 'Возврат частично', tone: 'neutral' },
    };
    const m = map[booking.paymentStatus] || { label: booking.paymentStatus, tone: 'neutral' as BadgeTone };
    return <span style={{ ...badge(m.tone), fontSize: 11, padding: '3px 10px', whiteSpace: 'nowrap' }}>{m.label}</span>;
}

/* ── Время ожидания ───────────────────────────────────────────────────── */

/** «ожидает 18 ч» / «ожидает 2 ч 40 мин» / «ожидает 3 дн.» — сколько прошло с оплаты (таймера/автоотклонения нет). */
export function waitingSince(paidAt: string | null | undefined, detailed = false): string {
    if (!paidAt) return '';
    const ms = Date.now() - new Date(paidAt).getTime();
    if (!Number.isFinite(ms) || ms < 0) return '';
    const min = Math.floor(ms / 60000);
    if (min < 60) return `ожидает ${Math.max(min, 1)} мин`;
    const h = Math.floor(min / 60);
    if (h < 48) return detailed ? `ожидает ${h} ч ${min % 60} мин` : `ожидает ${h} ч`;
    const d = Math.floor(h / 24);
    return `ожидает ${d} ${plural(d, 'день', 'дня', 'дней')}`;
}

/* ── Люди ─────────────────────────────────────────────────────────────── */

/** «Иван П.» из объекта туриста (формат LT: first_name/last_name, либо name/surname). */
export function touristShort(tt: BookingTourist): string {
    const first = String(tt.first_name || tt.firstName || tt.name || '').trim();
    const last = String(tt.last_name || tt.lastName || tt.surname || '').trim();
    if (!first && !last) return '';
    return last ? `${first ? `${first} ` : ''}${last.charAt(0).toUpperCase()}.` : first;
}

/** «2 взрослых · Иван П., Анна П.» */
export function touristsLine(b: Pick<Booking, 'adults' | 'kids'>, tourists?: BookingTourist[] | null): string {
    const parts: string[] = [];
    const a = Number(b.adults) || 0;
    const k = Number(b.kids) || 0;
    if (a) parts.push(`${a} ${plural(a, 'взрослый', 'взрослых', 'взрослых')}`);
    if (k) parts.push(`${k} ${plural(k, 'ребёнок', 'ребёнка', 'детей')}`);
    const names = (tourists || []).map(touristShort).filter(Boolean);
    const head = parts.join(' + ') || (names.length ? `${names.length} ${plural(names.length, 'турист', 'туриста', 'туристов')}` : '—');
    return names.length ? `${head} · ${names.join(', ')}` : head;
}

/** «2 взр. + 1 реб.» для таблицы. */
export function paxShort(b: Pick<Booking, 'adults' | 'kids'>): string {
    const a = Number(b.adults) || 0;
    const k = Number(b.kids) || 0;
    if (!a && !k) return '';
    return `${a} взр.${k ? ` + ${k} реб.` : ''}`;
}

/* ── Таймлайн ─────────────────────────────────────────────────────────── */

export interface TimelineItem {
    key: string;
    title: string;
    sub: string;
    tone: 'neutral' | 'success' | 'warning' | 'error';
}

const str = (v: unknown): string => (v === null || v === undefined ? '' : String(v));

/** Событие бронирования → строка истории (как в макете: «Оплачен 86 850 ₽ · 10.09 14:20 · VTB»). */
export function describeBookingEvent(ev: BookingEvent, b: Pick<Booking, 'finalPrice' | 'rejectReasonLabel'>): TimelineItem {
    const p = (ev.payload || {}) as Record<string, unknown>;
    const when = formatShortDateTime(ev.createdAt);
    const who = ev.staffName || '';
    const amount = (v: unknown) => formatMoney(typeof v === 'number' ? v : Number(v) || b.finalPrice);
    const reasonOf = (v: unknown) => {
        const map: Record<string, string> = { no_availability: 'нет мест', price_changed: 'цена изменилась', data_error: 'ошибка в данных', other: 'другое' };
        return map[str(v)] || b.rejectReasonLabel || str(v);
    };
    const kindOf = (v: unknown) => {
        const map: Record<string, string> = { paid: 'оплата получена', confirmed: 'подтверждение', rejected: 'отклонение', cancelled: 'отмена', refund_done: 'возврат выполнен', voucher: 'ваучер' };
        return map[str(v)] || str(v);
    };
    switch (ev.type) {
        case 'created':
            return { key: String(ev.id), title: 'Создан', sub: [when, 'клиент'].filter(Boolean).join(' · '), tone: 'neutral' };
        case 'paid':
            return { key: String(ev.id), title: `Оплачен ${amount(p.amount)}`, sub: [when, p.source ? `СБП · ${str(p.source)}` : 'СБП'].join(' · '), tone: 'success' };
        case 'payment_failed':
            return { key: String(ev.id), title: 'Оплата не прошла', sub: [when, p.payStatus ? str(p.payStatus) : ''].filter(Boolean).join(' · '), tone: 'error' };
        case 'confirmed':
            return { key: String(ev.id), title: `Подтверждено${p.hotelBookingRef ? ` · ${str(p.hotelBookingRef)}` : ''}`, sub: [when, who, p.voucher ? 'ваучер приложен' : ''].filter(Boolean).join(' · '), tone: 'success' };
        case 'rejected':
            return { key: String(ev.id), title: `Отклонено · ${reasonOf(p.reason)}`, sub: [when, who, p.refundAmount !== undefined ? `к возврату ${amount(p.refundAmount)}` : ''].filter(Boolean).join(' · '), tone: 'error' };
        case 'cancelled':
            return { key: String(ev.id), title: `Отменено · ${reasonOf(p.reason)}`, sub: [when, who, p.refundAmount !== undefined ? `к возврату ${amount(p.refundAmount)}` : ''].filter(Boolean).join(' · '), tone: 'error' };
        case 'refund_done':
            return { key: String(ev.id), title: `Возврат ${amount(p.amount)} выполнен`, sub: [when, who || (p.source ? str(p.source) : 'вручную')].filter(Boolean).join(' · '), tone: 'success' };
        case 'voucher_uploaded':
            return { key: String(ev.id), title: 'Ваучер загружен', sub: [when, who].filter(Boolean).join(' · '), tone: 'neutral' };
        case 'voucher_sent':
            return { key: String(ev.id), title: p.resend ? 'Ваучер отправлен повторно' : 'Ваучер отправлен', sub: [when, who].filter(Boolean).join(' · '), tone: 'success' };
        case 'comment':
            return { key: String(ev.id), title: 'Комментарий сотрудника', sub: [when, who].filter(Boolean).join(' · '), tone: 'neutral' };
        case 'notified': {
            const ok = p.sent !== false && !p.error;
            return { key: String(ev.id), title: `Клиент уведомлён: ${kindOf(p.kind)}${ok ? '' : ' — ошибка отправки'}`, sub: [when, ok ? 'e-mail + push' : str(p.error)].filter(Boolean).join(' · '), tone: ok ? 'neutral' : 'warning' };
        }
        default:
            return { key: String(ev.id), title: String(ev.type), sub: [when, who].filter(Boolean).join(' · '), tone: 'neutral' };
    }
}

/** Подзаголовок карточки: «Оплачено 86 850 ₽ · 10.09 14:20 · Arlekino · ожидает решения сотрудника». */
export function bookingSubtitle(b: Booking): string {
    switch (b.status) {
        case 'pending_payment':
            return `Не оплачено · создано ${formatDateTime(b.createdAt)} · ${b.operator}`;
        case 'pending_confirmation':
            return `Оплачено ${formatMoney(b.paidAmount ?? b.finalPrice)} · ${formatShortDateTime(b.paidAt)} · ${b.operator} · ожидает решения сотрудника`;
        case 'confirmed':
            return [`Подтверждено ${formatShortDateTime(b.confirmedAt)}`, b.confirmedBy, b.hotelBookingRef ? `бронь у отеля ${b.hotelBookingRef}` : 'без номера брони'].filter(Boolean).join(' · ');
        case 'rejected':
        case 'cancelled': {
            const refund = b.refund ? (b.refund.status === 'done' ? `возврат ${formatMoney(b.refund.amount)} выполнен` : `возврат ${formatMoney(b.refund.amount)} в обработке`) : '';
            return [`${b.status === 'rejected' ? 'Отклонено' : 'Отменено'} ${formatShortDateTime(b.rejectedAt)}`, b.rejectedBy, refund].filter(Boolean).join(' · ');
        }
        default:
            return b.statusText || '';
    }
}
