'use client';

// Вкладка «Бронирования» (макеты 2139:105678, пусто — 2141:106166): сводка, фильтры,
// таблица GET /bookings, быстрые «Подтвердить»/«Отклонить» из строки. Данные — только Totus (Level.Travel не участвует).

import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react';
import { useRouter } from 'next/navigation';
import Icon from '@/components/Icon';
import { t, radius, text, button } from '@/lib/theme';
import { ErrorBox, SuccessBox, compactInput, selectStyle, fieldLabel } from '@/components/notifications/shared';
import { listBookings, formatMoney, type Booking, type BookingListStatus, type BookingsSummary } from '@/lib/rooms-api';
import { Chip, Spinner, TableWrap, tableStyle, thStyle, tdStyle, tdRight, thRight, useDebounced, formatDateRange, formatShortDateTime, plural } from './shared';
import BookingStatusBadge, { PaymentBadge, waitingSince, paxShort } from './BookingStatusBadge';
import ConfirmBookingDialog from './ConfirmBookingDialog';
import RejectBookingDialog from './RejectBookingDialog';

const PAGE_LIMIT = 25;

const STATUS_TABS: { value: BookingListStatus; label: string }[] = [
    { value: 'all', label: 'Все' },
    { value: 'pending', label: 'Ожидают' },
    { value: 'confirmed', label: 'Подтверждены' },
    { value: 'rejected', label: 'Отклонены' },
    { value: 'refund', label: 'Возврат' },
    { value: 'unpaid', label: 'Не оплачены' },
];

function SummaryCard({ title, value, hint, tone }: { title: string; value: string; hint: string; tone?: 'accent' | 'neutral' }) {
    return (
        <div style={{ padding: '14px 16px', borderRadius: radius.md, border: `1px solid ${t.border}`, background: t.surface, boxShadow: t.shadowCard, minWidth: 0 }}>
            <div style={text.caption}>{title}</div>
            <div style={{ fontSize: 24, lineHeight: '32px', fontWeight: 700, color: tone === 'accent' ? t.accent : t.textPrimary, margin: '2px 0' }}>{value}</div>
            <div style={{ ...text.caption, fontSize: 12 }}>{hint}</div>
        </div>
    );
}

function Summary({ s }: { s: BookingsSummary | null }) {
    const pending = s?.pending || 0;
    return (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
            <SummaryCard title="Ожидают подтверждения" value={String(pending)} hint={pending ? 'ответить клиенту как можно скорее' : 'всё обработано'} tone={pending ? 'accent' : 'neutral'} />
            <SummaryCard title="Подтверждено за 30 дней" value={String(s?.confirmed30d || 0)} hint="наши Room Type · Arlekino" />
            <SummaryCard title="Отклонено и отменено" value={String(s?.rejected || 0)} hint={s?.refundPending ? `${s.refundPending} ${plural(s.refundPending, 'возврат', 'возврата', 'возвратов')} в обработке` : 'возвраты выполнены'} />
            <SummaryCard title="Сумма к возврату" value={formatMoney(s?.refundPendingAmount || 0)} hint={s?.refundPending ? 'возвращаем вручную' : 'нет незавершённых возвратов'} />
        </div>
    );
}

const filterCol: CSSProperties = { display: 'grid', gap: 6, minWidth: 0 };

export default function BookingsTab({ onSummary }: { onSummary?: (s: BookingsSummary) => void }) {
    const router = useRouter();
    const [items, setItems] = useState<Booking[]>([]);
    const [total, setTotal] = useState(0);
    const [summary, setSummary] = useState<BookingsSummary | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [notice, setNotice] = useState<string | null>(null);

    const [status, setStatus] = useState<BookingListStatus>('pending');
    const [hotelId, setHotelId] = useState('');
    const [operator, setOperator] = useState('');
    const [from, setFrom] = useState('');
    const [to, setTo] = useState('');
    const [q, setQ] = useState('');
    const debouncedQ = useDebounced(q, 350);
    const [page, setPage] = useState(1);

    const [confirming, setConfirming] = useState<Booking | null>(null);
    const [rejecting, setRejecting] = useState<Booking | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await listBookings({
                status,
                hotel_id: hotelId || undefined,
                operator: operator || undefined,
                q: debouncedQ.trim() || undefined,
                from: from || undefined,
                to: to ? `${to}T23:59:59` : undefined,
                page,
                limit: PAGE_LIMIT,
            });
            setItems(data.items || []);
            setTotal(Number(data.total) || 0);
            setSummary(data.summary || null);
            if (data.summary && onSummary) onSummary(data.summary);
        } catch (e: any) {
            setError(e?.message || 'Не удалось загрузить бронирования');
        } finally {
            setLoading(false);
        }
    }, [status, hotelId, operator, debouncedQ, from, to, page, onSummary]);

    useEffect(() => {
        load();
    }, [load]);

    useEffect(() => {
        setPage(1);
    }, [status, hotelId, operator, debouncedQ, from, to]);

    // Отели и операторы для селектов — из текущей выдачи (накапливаем, чтобы фильтр не «схлопывался»).
    const [hotels, setHotels] = useState<Map<number, string>>(new Map());
    const [operators, setOperators] = useState<Set<string>>(new Set());
    useEffect(() => {
        setHotels((prev) => {
            const next = new Map(prev);
            items.forEach((b) => {
                if (b.hotel?.id) next.set(b.hotel.id, b.hotel.name || `Отель #${b.hotel.id}`);
            });
            return next;
        });
        setOperators((prev) => {
            const next = new Set(prev);
            items.forEach((b) => b.operator && next.add(b.operator));
            return next;
        });
    }, [items]);

    const hotelOptions = useMemo(() => [...hotels.entries()].sort((a, b) => a[1].localeCompare(b[1], 'ru')), [hotels]);
    const operatorOptions = useMemo(() => [...operators].sort(), [operators]);

    const patch = (next: Booking) => {
        setItems((list) => list.map((x) => (x.bookingId === next.bookingId ? { ...x, ...next } : x)));
        load();
    };

    const open = (b: Booking) => router.push(`/rooms/booking/${b.bookingId}`);

    const pages = Math.max(1, Math.ceil(total / PAGE_LIMIT));
    const hasFilters = status !== 'all' || hotelId || operator || from || to || q;

    return (
        <div style={{ display: 'grid', gap: 16 }}>
            <Summary s={summary} />

            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(280px, 2fr) repeat(4, minmax(140px, 1fr))', gap: 12, alignItems: 'end' }}>
                <div style={filterCol}>
                    <span style={fieldLabel}>Статус</span>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {STATUS_TABS.map((s) => (
                            <Chip key={s.value} active={status === s.value} onClick={() => setStatus(s.value)}>
                                {s.label}
                                {s.value === 'pending' && summary?.pending ? ` · ${summary.pending}` : ''}
                                {s.value === 'refund' && summary?.refundPending ? ` · ${summary.refundPending}` : ''}
                            </Chip>
                        ))}
                    </div>
                </div>
                <div style={filterCol}>
                    <span style={fieldLabel}>Отель</span>
                    <select style={selectStyle} value={hotelId} onChange={(e) => setHotelId(e.target.value)}>
                        <option value="">Все отели</option>
                        {hotelOptions.map(([id, name]) => (
                            <option key={id} value={id}>{name}</option>
                        ))}
                    </select>
                </div>
                <div style={filterCol}>
                    <span style={fieldLabel}>Оператор</span>
                    <select style={selectStyle} value={operator} onChange={(e) => setOperator(e.target.value)}>
                        <option value="">Все операторы</option>
                        {operatorOptions.map((name) => (
                            <option key={name} value={name}>{name}</option>
                        ))}
                    </select>
                </div>
                <div style={filterCol}>
                    <span style={fieldLabel}>Период создания</span>
                    <div style={{ display: 'flex', gap: 6 }}>
                        <input type="date" style={compactInput} value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} aria-label="С даты" />
                        <input type="date" style={compactInput} value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} aria-label="По дату" />
                    </div>
                </div>
                <div style={filterCol}>
                    <span style={fieldLabel}>Поиск</span>
                    <input style={compactInput} value={q} onChange={(e) => setQ(e.target.value)} placeholder="№ заказа, отель, клиент" />
                </div>
            </div>

            <ErrorBox message={error} />
            <SuccessBox message={notice} />

            {loading && !items.length ? <Spinner label="Загружаем бронирования..." /> : null}

            {!loading && !items.length && !error ? (
                <div style={{ padding: '48px 24px', textAlign: 'center', border: `1px solid ${t.border}`, borderRadius: radius.lg, background: t.surface }}>
                    <div style={{ width: 64, height: 64, borderRadius: radius.pill, background: t.accentSoft, color: t.accent, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
                        <Icon name="hotel" size={28} />
                    </div>
                    <div style={{ ...text.sectionTitle, marginBottom: 6 }}>{status === 'pending' ? 'Новых бронирований нет' : 'Бронирований не найдено'}</div>
                    <div style={{ ...text.body, maxWidth: 420, margin: '0 auto 20px' }}>
                        {status === 'pending'
                            ? 'Бронирования наших Room Type появятся здесь сразу после оплаты клиентом. Подтвердите или отклоните их как можно скорее — автоотклонения нет.'
                            : 'Попробуйте изменить фильтры или период.'}
                    </div>
                    <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
                        <button type="button" onClick={() => router.push('/rooms?tab=room-types')} style={button('secondary', 'md')}>Наши Room Type</button>
                        {hasFilters ? (
                            <button
                                type="button"
                                onClick={() => {
                                    setStatus('all');
                                    setHotelId('');
                                    setOperator('');
                                    setFrom('');
                                    setTo('');
                                    setQ('');
                                }}
                                style={{ ...button('tertiary', 'md'), color: t.accent }}
                            >
                                Показать все статусы
                            </button>
                        ) : null}
                    </div>
                </div>
            ) : null}

            {items.length ? (
                <TableWrap>
                    <table style={tableStyle}>
                        <thead>
                            <tr>
                                <th style={thStyle}>№ заказа</th>
                                <th style={thStyle}>Клиент</th>
                                <th style={thStyle}>Отель · Номер</th>
                                <th style={thStyle}>Даты</th>
                                <th style={thRight}>LT → наша · маржа</th>
                                <th style={thStyle}>Оплата</th>
                                <th style={thStyle}>Статус</th>
                                <th style={thRight}>Действия</th>
                            </tr>
                        </thead>
                        <tbody>
                            {items.map((b) => {
                                const margin = b.finalPrice != null && b.providerPrice != null ? b.finalPrice - b.providerPrice : null;
                                const pending = b.status === 'pending_confirmation';
                                const statusSub = pending
                                    ? waitingSince(b.paidAt)
                                    : b.status === 'confirmed'
                                        ? [b.confirmedBy, formatShortDateTime(b.confirmedAt)].filter(Boolean).join(' · ')
                                        : b.status === 'rejected' || b.status === 'cancelled'
                                            ? b.refund?.status === 'done'
                                                ? `вручную · ${formatShortDateTime(b.refund.at)}`
                                                : b.rejectReasonLabel || ''
                                            : '';
                                return (
                                    <tr key={b.bookingId} style={{ cursor: 'pointer' }} onClick={() => open(b)}>
                                        <td style={tdStyle}>
                                            <div style={{ fontWeight: 700 }}>№ {b.orderId}</div>
                                            <div style={text.caption}>{formatShortDateTime(b.createdAt)}</div>
                                        </td>
                                        <td style={tdStyle}>
                                            <div style={{ fontWeight: 600 }}>{b.customer?.name || '—'}</div>
                                            <div style={text.caption}>{b.customer?.phone || b.customer?.email || ''}</div>
                                        </td>
                                        <td style={{ ...tdStyle, maxWidth: 220 }}>
                                            <div style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={b.hotel?.name || ''}>
                                                {b.hotel?.name || '—'}
                                            </div>
                                            <div style={{ ...text.caption, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                {[b.room, b.operator].filter(Boolean).join(' · ')}
                                            </div>
                                        </td>
                                        <td style={{ ...tdStyle, whiteSpace: 'nowrap' }}>
                                            <div>{formatDateRange(b.checkIn, b.nights)}{b.nights ? ` · ${b.nights} ${plural(b.nights, 'ночь', 'ночи', 'ночей')}` : ''}</div>
                                            <div style={text.caption}>{paxShort(b)}</div>
                                        </td>
                                        <td style={tdRight}>
                                            <div>{formatMoney(b.providerPrice)} → <span style={{ fontWeight: 700 }}>{formatMoney(b.finalPrice)}</span></div>
                                            <div style={{ fontSize: 12, color: margin == null ? t.textTertiary : margin < 0 ? t.error : t.success }}>маржа {formatMoney(margin, true)}</div>
                                        </td>
                                        <td style={tdStyle}><PaymentBadge booking={b} /></td>
                                        <td style={tdStyle}>
                                            <BookingStatusBadge booking={b} />
                                            {statusSub ? <div style={{ ...text.caption, marginTop: 4, color: pending ? t.warning : t.textTertiary }}>{statusSub}</div> : null}
                                        </td>
                                        <td style={tdRight} onClick={(e) => e.stopPropagation()}>
                                            <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                                                {pending ? (
                                                    <>
                                                        <button type="button" onClick={() => setConfirming(b)} style={button('primary', 'sm')}>Подтвердить</button>
                                                        <button type="button" onClick={() => setRejecting(b)} style={button('secondary', 'sm')}>Отклонить</button>
                                                    </>
                                                ) : null}
                                                <button type="button" onClick={() => open(b)} style={pending ? { ...button('tertiary', 'sm'), color: t.accent } : button('secondary', 'sm')}>
                                                    Открыть
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, padding: '10px 12px', ...text.caption }}>
                        <span>Показано {items.length} из {total}{loading ? ' · обновляем…' : ''}</span>
                        {pages > 1 ? (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                <button type="button" disabled={page <= 1} onClick={() => setPage(page - 1)} style={{ ...button('tertiary', 'sm'), padding: '2px 6px' }} aria-label="Назад">‹</button>
                                {Array.from({ length: pages }, (_, i) => i + 1)
                                    .filter((p) => p === 1 || p === pages || Math.abs(p - page) <= 2)
                                    .map((p, i, arr) => (
                                        <span key={p} style={{ display: 'inline-flex', alignItems: 'center' }}>
                                            {i > 0 && arr[i - 1] !== p - 1 ? <span style={{ padding: '0 4px' }}>…</span> : null}
                                            <button type="button" onClick={() => setPage(p)} style={{ ...button('tertiary', 'sm'), padding: '2px 6px', color: p === page ? t.textPrimary : t.textSecondary, fontWeight: p === page ? 700 : 500 }}>
                                                {p}
                                            </button>
                                        </span>
                                    ))}
                                <button type="button" disabled={page >= pages} onClick={() => setPage(page + 1)} style={{ ...button('tertiary', 'sm'), padding: '2px 6px' }} aria-label="Вперёд">›</button>
                            </span>
                        ) : null}
                    </div>
                </TableWrap>
            ) : null}

            {confirming ? (
                <ConfirmBookingDialog
                    booking={confirming}
                    onClose={() => setConfirming(null)}
                    onDone={(next) => {
                        setConfirming(null);
                        setNotice(`Бронирование № ${next.orderId} подтверждено`);
                        patch(next);
                    }}
                />
            ) : null}
            {rejecting ? (
                <RejectBookingDialog
                    booking={rejecting}
                    onClose={() => setRejecting(null)}
                    onDone={(next) => {
                        setRejecting(null);
                        setNotice(`Бронирование № ${next.orderId} отклонено`);
                        patch(next);
                    }}
                />
            ) : null}
        </div>
    );
}
