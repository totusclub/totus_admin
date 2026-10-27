'use client';

// Карточка бронирования наших Room Type (без Level.Travel): /rooms/booking/[id].
// Макеты: ожидает — 2140:105678, подтверждено — 2140:106028, отклонено — 2140:106390.
// Данные — GET /api/admin/rooms/bookings/:id; действия — confirm/reject/cancel/refund-done/voucher/resend-voucher/comment.
// ПД клиента (имя, телефон, e-mail) показываем на странице, в URL/логи не выносим.

import { Suspense, useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { useParams, useRouter } from 'next/navigation';
import PageShell from '@/components/PageShell';
import AdminNav from '@/components/AdminNav';
import Icon from '@/components/Icon';
import { t, radius, text, button, cardStyle, textareaStyle } from '@/lib/theme';
import { PageHeader, pageCard, space } from '@/components/PageKit';
import { getStaffAuth, staffLogout, type StaffAuth } from '@/lib/staff-auth-api';
import { ErrorBox, SuccessBox } from '@/components/notifications/shared';
import {
    getBooking, bookingRefundDone, commentBooking, uploadBookingVoucher, resendBookingVoucher, formatMoney,
    type Booking, type BookingDetails,
} from '@/lib/rooms-api';
import { Breadcrumbs, Spinner, ConfirmDialog, formatDateRange, formatDateTime, formatShortDateTime, mealLabel, plural, timeAgo } from '@/components/rooms/shared';
import BookingStatusBadge, { bookingSubtitle, describeBookingEvent, touristsLine, waitingSince } from '@/components/rooms/BookingStatusBadge';
import ConfirmBookingDialog from '@/components/rooms/ConfirmBookingDialog';
import RejectBookingDialog from '@/components/rooms/RejectBookingDialog';

const MAX_VOUCHER = 10 * 1024 * 1024;
const capitalize = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

function Row({ label, children }: { label: string; children: ReactNode }) {
    return (
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, padding: '5px 0', fontSize: 14, lineHeight: '20px' }}>
            <span style={{ color: t.textTertiary, flexShrink: 0 }}>{label}</span>
            <span style={{ color: t.textPrimary, fontWeight: 600, textAlign: 'right', minWidth: 0, overflowWrap: 'anywhere' }}>{children}</span>
        </div>
    );
}

function Card({ title, right, children }: { title: string; right?: ReactNode; children: ReactNode }) {
    return (
        <div style={cardStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                <h2 style={{ ...text.cardTitle, margin: 0 }}>{title}</h2>
                {right}
            </div>
            {children}
        </div>
    );
}

function InfoNote() {
    return (
        <div style={{ display: 'flex', gap: 8, padding: '10px 12px', borderRadius: radius.sm, background: t.surfaceInset, border: `1px solid ${t.border}`, ...text.caption, color: t.textSecondary }}>
            <Icon name="info" size={16} style={{ color: t.textTertiary, marginTop: 1 }} />
            <span>Заказ хранится только в Totus. В Level.Travel не отправляется.</span>
        </div>
    );
}

function Timeline({ data }: { data: BookingDetails }) {
    const items = [...data.events].sort((a, b) => (a.id || 0) - (b.id || 0)).map((ev) => describeBookingEvent(ev, data.booking));
    const dot = (tone: string) => (tone === 'success' ? t.success : tone === 'error' ? t.error : tone === 'warning' ? t.warning : t.borderStrong);
    if (!items.length) return <div style={text.caption}>Событий пока нет</div>;
    return (
        <div style={{ display: 'grid' }}>
            {items.map((it, i) => (
                <div key={it.key} style={{ display: 'grid', gridTemplateColumns: '12px 1fr', gap: 10 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                        <span style={{ width: 10, height: 10, borderRadius: radius.pill, background: dot(it.tone), marginTop: 5, flexShrink: 0 }} />
                        {i < items.length - 1 ? <span style={{ width: 2, flex: 1, background: t.border, minHeight: 14 }} /> : null}
                    </div>
                    <div style={{ paddingBottom: i < items.length - 1 ? 12 : 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 600, color: t.textPrimary, lineHeight: '20px' }}>{it.title}</div>
                        <div style={text.caption}>{it.sub}</div>
                    </div>
                </div>
            ))}
        </div>
    );
}

function BookingContent() {
    const router = useRouter();
    const params = useParams<{ id: string }>();
    const id = Number(params?.id);

    const [authChecked, setAuthChecked] = useState(false);
    const [auth, setAuth] = useState<StaffAuth | null>(null);
    const [data, setData] = useState<BookingDetails | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [notice, setNotice] = useState<string | null>(null);
    const [busy, setBusy] = useState<string>('');

    const [confirming, setConfirming] = useState(false);
    const [rejecting, setRejecting] = useState<'reject' | 'cancel' | null>(null);
    const [refundConfirm, setRefundConfirm] = useState(false);
    const [comment, setComment] = useState('');
    const fileRef = useRef<HTMLInputElement | null>(null);

    useEffect(() => {
        setAuth(getStaffAuth());
        setAuthChecked(true);
    }, []);

    useEffect(() => {
        if (authChecked && !auth) {
            staffLogout();
            router.replace('/login');
        }
    }, [authChecked, auth, router]);

    const load = useCallback(async (silent = false) => {
        if (!auth || !id) return;
        if (!silent) setLoading(true);
        setError(null);
        try {
            const d = await getBooking(id);
            setData(d);
            setComment(d.booking.staffComment || '');
        } catch (e: any) {
            setError(e?.message || 'Не удалось загрузить бронирование');
        } finally {
            setLoading(false);
        }
    }, [auth, id]);

    useEffect(() => {
        load();
    }, [load]);

    const b = data?.booking;

    const run = async (key: string, fn: () => Promise<Booking | void>, okText: string) => {
        setBusy(key);
        setError(null);
        setNotice(null);
        try {
            await fn();
            setNotice(okText);
            await load(true);
        } catch (e: any) {
            setError(e?.message || 'Не удалось выполнить действие');
        } finally {
            setBusy('');
        }
    };

    const onVoucherFile = (f: File | null | undefined) => {
        if (!f || !b) return;
        if (!(f.type === 'application/pdf' || /\.pdf$/i.test(f.name))) {
            setError('Допустим только PDF');
            return;
        }
        if (f.size > MAX_VOUCHER) {
            setError('Файл ваучера больше 10 МБ');
            return;
        }
        run('voucher', () => uploadBookingVoucher(b.bookingId, f), 'Ваучер загружен');
    };

    if (!authChecked || !auth) {
        return (
            <PageShell>
                <AdminNav />
            </PageShell>
        );
    }

    const margin = b && b.finalPrice != null && b.providerPrice != null ? b.finalPrice - b.providerPrice : null;
    const paid = b ? b.paidAmount ?? b.finalPrice : null;
    const isPending = b?.status === 'pending_confirmation';
    const isConfirmed = b?.status === 'confirmed';
    const isClosed = b?.status === 'rejected' || b?.status === 'cancelled';
    const rt = data?.roomType;

    return (
        <PageShell>
            <AdminNav />
            <input ref={fileRef} type="file" accept="application/pdf,.pdf" hidden onChange={(e) => {
                onVoucherFile(e.target.files?.[0]);
                e.target.value = '';
            }} />

            <div style={{ display: 'grid', gap: space.page }}>
                {/* Шапка: крошки, заголовок и срок ожидания — одна карточка, как на других страницах-деталях */}
                <div style={pageCard}>
                    <PageHeader
                        before={
                            <Breadcrumbs
                                items={[
                                    { label: 'Отели и номера', onClick: () => router.push('/rooms?tab=bookings') },
                                    { label: 'Бронирования', onClick: () => router.push('/rooms?tab=bookings') },
                                    { label: b ? `№ ${b.orderId}` : `#${id}` },
                                ]}
                            />
                        }
                        title={
                            b ? (
                                <>
                                    Бронирование № {b.orderId}
                                    <BookingStatusBadge booking={b} size="md" />
                                </>
                            ) : (
                                'Бронирование'
                            )
                        }
                        subtitle={b ? bookingSubtitle(b) : undefined}
                        actions={
                            b && isPending ? (
                                <div style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '10px 14px', borderRadius: radius.md, background: t.warningSoft, color: t.warning }}>
                                    <Icon name="calendar" size={18} />
                                    <div>
                                        <div style={{ fontSize: 14, fontWeight: 700, lineHeight: '20px' }}>{capitalize(waitingSince(b.paidAt, true) || 'ожидает решения')}</div>
                                        <div style={{ fontSize: 12, lineHeight: '16px', opacity: 0.85 }}>с момента оплаты {formatShortDateTime(b.paidAt)} · автоотклонения нет</div>
                                    </div>
                                </div>
                            ) : undefined
                        }
                    />
                    {loading ? <Spinner label="Загружаем бронирование..." /> : null}
                </div>

                <ErrorBox message={error} />
                <SuccessBox message={notice} />

                {!loading && b && data ? (
                    <>
                        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(300px, 1fr)', gap: space.page, alignItems: 'start' }}>
                            {/* Левая колонка */}
                            <div style={{ display: 'grid', gap: space.page, minWidth: 0 }}>
                                <Card
                                    title="Бронирование"
                                    right={
                                        <button type="button" onClick={() => router.push(`/orders/${encodeURIComponent(b.orderId)}`)} style={{ ...button('tertiary', 'sm'), color: t.accent, padding: '4px 6px' }}>
                                            Открыть заказ клиента
                                        </button>
                                    }
                                >
                                    <div style={{ marginBottom: 12 }}>
                                        <div style={{ ...text.sectionTitle, fontSize: 18, lineHeight: '26px' }}>
                                            {b.hotel?.name || '—'}{b.hotel?.stars ? ` ${b.hotel.stars}*` : ''}
                                        </div>
                                        <div style={text.body}>{[b.hotel?.city, b.hotelCountry].filter(Boolean).join(', ')}</div>
                                        <div style={{ ...text.caption, marginTop: 6, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                            <span style={{ padding: '2px 8px', borderRadius: radius.pill, background: t.surfaceInset, border: `1px solid ${t.border}`, color: t.textSecondary, fontWeight: 600, fontSize: 11 }}>{b.operator}</span>
                                            наша Room Type · Level.Travel не участвует
                                        </div>
                                    </div>
                                    <div style={{ borderTop: `1px solid ${t.border}`, paddingTop: 8, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', columnGap: 24 }}>
                                        <div>
                                            <Row label="Номер">{b.room || '—'}</Row>
                                            <Row label="Питание">{b.mealName ? `${b.mealName}${b.meal ? ` (${b.meal})` : ''}` : mealLabel(b.meal)}</Row>
                                            <Row label="Даты">{formatDateRange(b.checkIn, b.nights)}{b.nights ? ` · ${b.nights} ${plural(b.nights, 'ночь', 'ночи', 'ночей')}` : ''}</Row>
                                            <Row label="Заезд / выезд">{formatDateRange(b.checkIn, 0)} → {formatDateRange(b.checkOut, 0)}</Row>
                                        </div>
                                        <div>
                                            <Row label="Туристы">{touristsLine(b, data.booking.tourists)}</Row>
                                            <Row label="Контакт покупателя">{[b.customer?.name, b.customer?.phone, b.customer?.email].filter(Boolean).join(' · ') || '—'}</Row>
                                            <Row label="Перелёт">Без перелёта</Row>
                                            <Row label="Оплата">
                                                {b.paidAt ? `СБП · ${formatDateTime(b.paidAt)} · ${formatMoney(paid)}` : `не оплачено${data.order.payStatus ? ` · ${data.order.payStatus}` : ''}`}
                                            </Row>
                                        </div>
                                    </div>
                                </Card>

                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: space.page }}>
                                    <Card title="Цена">
                                        <Row label="Цена Level.Travel">{formatMoney(b.providerPrice)}</Row>
                                        <Row label="Правило">{b.priceRule?.label || '—'}{b.operator ? ` (${b.operator})` : ''}</Row>
                                        <div style={{ borderTop: `1px solid ${t.border}`, marginTop: 6, paddingTop: 6 }}>
                                            <Row label={b.paidAt ? 'Наша цена · оплачено' : 'Наша цена'}><span style={{ fontSize: 16 }}>{formatMoney(b.finalPrice)}</span></Row>
                                            <Row label="Маржа"><span style={{ color: margin == null ? t.textTertiary : margin < 0 ? t.error : t.success }}>{formatMoney(margin, true)}</span></Row>
                                        </div>
                                    </Card>
                                    <Card title="Room Type">
                                        <button
                                            type="button"
                                            onClick={() => router.push(`/rooms/room-type/${rt?.id || b.roomTypeId}`)}
                                            style={{ ...button('tertiary', 'sm'), color: t.accent, padding: '4px 0', fontSize: 14, marginBottom: 4 }}
                                        >
                                            {rt?.name || b.room || `Room Type #${b.roomTypeId}`} · Totus
                                            <Icon name="chevronRight" size={16} />
                                        </button>
                                        <Row label="Источник">{rt?.sourceRoomName || b.sourceRoomName || '—'} · Level.Travel</Row>
                                        <Row label="Статус">{rt?.active === undefined ? '—' : rt.active ? 'Активен' : 'Выключен'}</Row>
                                        {rt?.hotelName ? <Row label="Отель">{rt.hotelName}</Row> : null}
                                    </Card>
                                </div>

                                <Card title="Комментарий для сотрудников">
                                    <textarea style={{ ...textareaStyle, minHeight: 64 }} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Не виден клиенту" maxLength={4000} />
                                    <div style={{ marginTop: 10, display: 'flex', gap: 8, alignItems: 'center' }}>
                                        <button
                                            type="button"
                                            disabled={busy === 'comment' || (comment || '') === (b.staffComment || '')}
                                            onClick={() => run('comment', () => commentBooking(b.bookingId, comment.trim()), 'Комментарий сохранён')}
                                            style={{ ...button('secondary', 'sm'), opacity: busy === 'comment' || (comment || '') === (b.staffComment || '') ? 0.6 : 1 }}
                                        >
                                            {busy === 'comment' ? 'Сохраняем...' : 'Сохранить'}
                                        </button>
                                        {b.updatedAt ? <span style={text.caption}>обновлено {timeAgo(b.updatedAt)}</span> : null}
                                    </div>
                                </Card>
                            </div>

                            {/* Правая колонка */}
                            <div style={{ display: 'grid', gap: space.page, minWidth: 0 }}>
                                <div style={{ ...cardStyle, display: 'grid', gap: 10 }}>
                                    {isPending ? (
                                        <>
                                            <button type="button" onClick={() => setConfirming(true)} style={{ ...button('primary', 'lg'), width: '100%' }}>
                                                <Icon name="check" size={18} />
                                                Подтвердить бронирование
                                            </button>
                                            <button type="button" onClick={() => setRejecting('reject')} style={{ ...button('secondary', 'lg'), width: '100%', color: t.error, borderColor: t.error }}>
                                                Отклонить
                                            </button>
                                            {b.voucher ? (
                                                <div style={{ ...text.caption, display: 'flex', alignItems: 'center', gap: 8 }}>
                                                    <Icon name="file" size={16} style={{ color: t.accent }} />
                                                    <span>Ваучер загружен — уйдёт клиенту с подтверждением.</span>
                                                    <a href={b.voucher.url} target="_blank" rel="noreferrer" style={{ color: t.accent, fontWeight: 600 }}>Открыть</a>
                                                </div>
                                            ) : (
                                                <button type="button" disabled={busy === 'voucher'} onClick={() => fileRef.current?.click()} style={{ ...button('tertiary', 'sm'), color: t.accent, justifyContent: 'flex-start' }}>
                                                    <Icon name="upload" size={16} />
                                                    {busy === 'voucher' ? 'Загружаем...' : 'Загрузить ваучер заранее (PDF)'}
                                                </button>
                                            )}
                                        </>
                                    ) : null}

                                    {isConfirmed ? (
                                        <>
                                            <div style={{ padding: '12px 14px', borderRadius: radius.md, background: t.successSoft, color: t.success }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, fontSize: 14 }}>
                                                    <Icon name="check" size={16} />
                                                    Подтверждено
                                                </div>
                                                <div style={{ fontSize: 13, lineHeight: '18px', marginTop: 4, color: t.textSecondary }}>
                                                    {[b.confirmedBy, formatShortDateTime(b.confirmedAt), b.hotelBookingRef ? `бронь у отеля ${b.hotelBookingRef}` : ''].filter(Boolean).join(' · ')}.
                                                    {b.voucher?.sentAt ? ' Клиенту отправлены push и e-mail с ваучером.' : b.voucher ? ' Ваучер загружен, но ещё не отправлен.' : ' Ваучер ещё не загружен.'}
                                                </div>
                                                {b.clientMessage ? <div style={{ ...text.caption, marginTop: 6 }}>Комментарий клиенту: {b.clientMessage}</div> : null}
                                            </div>
                                            {b.voucher ? (
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: radius.md, border: `1px solid ${t.border}` }}>
                                                    <Icon name="file" size={18} style={{ color: t.accent }} />
                                                    <div style={{ minWidth: 0, flex: 1 }}>
                                                        <div style={{ fontSize: 13, fontWeight: 600, color: t.textPrimary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.voucher.title || 'Ваучер'}.pdf</div>
                                                        <div style={text.caption}>{b.voucher.sentAt ? `отправлен ${formatShortDateTime(b.voucher.sentAt)}` : 'не отправлен'}</div>
                                                    </div>
                                                    <a href={b.voucher.url} target="_blank" rel="noreferrer" style={{ ...button('tertiary', 'sm'), color: t.accent, textDecoration: 'none' }}>Скачать</a>
                                                </div>
                                            ) : null}
                                            <button type="button" disabled={busy === 'voucher'} onClick={() => fileRef.current?.click()} style={{ ...button('secondary', 'md'), width: '100%' }}>
                                                <Icon name="upload" size={16} />
                                                {busy === 'voucher' ? 'Загружаем...' : b.voucher ? 'Заменить ваучер (PDF)' : 'Загрузить ваучер (PDF)'}
                                            </button>
                                            {b.voucher ? (
                                                <button
                                                    type="button"
                                                    disabled={busy === 'resend'}
                                                    onClick={() => run('resend', async () => {
                                                        const r = await resendBookingVoucher(b.bookingId);
                                                        if (r.result && r.result.sent === false) throw new Error(r.result.error || 'Письмо не отправлено — проверьте e-mail клиента');
                                                    }, 'Ваучер отправлен клиенту повторно')}
                                                    style={{ ...button('secondary', 'md'), width: '100%' }}
                                                >
                                                    <Icon name="mail" size={16} />
                                                    {busy === 'resend' ? 'Отправляем...' : 'Отправить ваучер повторно'}
                                                </button>
                                            ) : null}
                                            <button type="button" onClick={() => setRejecting('cancel')} style={{ ...button('secondary', 'md'), width: '100%', color: t.error, borderColor: t.error }}>
                                                Отменить бронирование
                                            </button>
                                        </>
                                    ) : null}

                                    {isClosed ? (
                                        <>
                                            <div style={{ padding: '12px 14px', borderRadius: radius.md, background: t.errorSoft, color: t.error }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, fontSize: 14 }}>
                                                    <Icon name="close" size={16} />
                                                    {b.status === 'rejected' ? 'Отклонено' : 'Отменено'}
                                                </div>
                                                <div style={{ fontSize: 13, lineHeight: '18px', marginTop: 4, color: t.textSecondary }}>
                                                    {b.rejectReasonLabel ? `Причина: ${b.rejectReasonLabel.toLowerCase()}. ` : ''}
                                                    {[b.rejectedBy, formatShortDateTime(b.rejectedAt)].filter(Boolean).join(' · ')}.
                                                </div>
                                                {b.rejectMessage ? <div style={{ ...text.caption, marginTop: 6 }}>Клиенту: {b.rejectMessage}</div> : null}
                                            </div>
                                            {b.refund ? (
                                                <div style={{ padding: '12px 14px', borderRadius: radius.md, background: t.surfaceInset, border: `1px solid ${t.border}` }}>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                                                        <span style={{ fontSize: 14, fontWeight: 700, color: t.textPrimary }}>Возврат {formatMoney(b.refund.amount)}</span>
                                                        <span style={{ padding: '2px 8px', borderRadius: radius.pill, fontSize: 11, fontWeight: 600, background: b.refund.status === 'done' ? t.surface : t.warningSoft, color: b.refund.status === 'done' ? t.textSecondary : t.warning, border: b.refund.status === 'done' ? `1px solid ${t.border}` : 'none' }}>
                                                            {b.refund.status === 'done' ? 'Выполнен' : 'В обработке'}
                                                        </span>
                                                    </div>
                                                    <div style={{ ...text.caption, marginTop: 4 }}>
                                                        {b.refund.status === 'done'
                                                            ? `вручную · выполнен ${formatShortDateTime(b.refund.at)}${b.refundBy ? ` · ${b.refundBy}` : ''} · ${Number(b.refund.amount) >= Number(paid) - 0.01 ? 'полностью' : 'частично'}`
                                                            : 'вручную · переведите деньги клиенту и отметьте возврат'}
                                                    </div>
                                                    {b.refund.status === 'pending' ? (
                                                        <button type="button" disabled={busy === 'refund'} onClick={() => setRefundConfirm(true)} style={{ ...button('primary', 'md'), width: '100%', marginTop: 10 }}>
                                                            {busy === 'refund' ? 'Отмечаем...' : 'Отметить возврат выполненным'}
                                                        </button>
                                                    ) : null}
                                                </div>
                                            ) : null}
                                        </>
                                    ) : null}

                                    {b.status === 'pending_payment' ? (
                                        <div style={text.body}>
                                            Заказ создан, но ещё не оплачен. Действия появятся после оплаты клиентом.
                                            {data.order.payUrl ? <div style={{ ...text.caption, marginTop: 6 }}>Ссылка на оплату выдана клиенту{data.order.payAmount ? ` · ${formatMoney(data.order.payAmount)}` : ''}.</div> : null}
                                        </div>
                                    ) : null}

                                    <InfoNote />
                                </div>

                                <Card title="История">
                                    <Timeline data={data} />
                                </Card>
                            </div>
                        </div>
                    </>
                ) : null}
            </div>

            {confirming && b ? (
                <ConfirmBookingDialog
                    booking={b}
                    onClose={() => setConfirming(false)}
                    onDone={() => {
                        setConfirming(false);
                        setNotice('Бронирование подтверждено');
                        load(true);
                    }}
                />
            ) : null}
            {rejecting && b ? (
                <RejectBookingDialog
                    booking={b}
                    mode={rejecting}
                    onClose={() => setRejecting(null)}
                    onDone={() => {
                        setRejecting(null);
                        setNotice(rejecting === 'cancel' ? 'Бронирование отменено' : 'Бронирование отклонено');
                        load(true);
                    }}
                />
            ) : null}
            {refundConfirm && b?.refund ? (
                <ConfirmDialog
                    title="Возврат выполнен?"
                    message={
                        <>
                            Отметить возврат <b>{formatMoney(b.refund.amount)}</b> клиенту по заказу № {b.orderId} как выполненный вручную. Клиент получит уведомление «Возврат выполнен».
                        </>
                    }
                    confirmLabel="Да, возврат выполнен"
                    busy={busy === 'refund'}
                    onClose={() => setRefundConfirm(false)}
                    onConfirm={() => {
                        setRefundConfirm(false);
                        run('refund', () => bookingRefundDone(b.bookingId), 'Возврат отмечен выполненным');
                    }}
                />
            ) : null}
        </PageShell>
    );
}

export default function BookingPage() {
    return (
        <Suspense
            fallback={
                <PageShell>
                    <AdminNav />
                </PageShell>
            }
        >
            <BookingContent />
        </Suspense>
    );
}
