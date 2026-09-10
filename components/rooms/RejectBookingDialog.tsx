'use client';

// Модал «Отклонить бронирование № …» (макет 2141:105919) — также для отмены уже подтверждённого (mode='cancel').
// Отличие от макета по решению владельца: возврат только вручную — способа «Через VTB» нет,
// вместо него чекбокс «Возврат уже выполнен» (иначе возврат остаётся «в обработке» до отметки в карточке).

import { useState } from 'react';
import { t, radius, text, button, textareaStyle } from '@/lib/theme';
import { Modal, Field, ErrorBox, compactInput, checkboxRow } from '@/components/notifications/shared';
import { rejectBooking, cancelBooking, formatMoney, RoomsApiError, BOOKING_REJECT_REASONS, type Booking, type BookingRejectReason } from '@/lib/rooms-api';

const DEFAULT_MESSAGES: Record<BookingRejectReason, string> = {
    no_availability: 'К сожалению, на выбранные даты в отеле нет свободных номеров этой категории. Деньги вернём полностью.',
    price_changed: 'К сожалению, стоимость размещения на выбранные даты изменилась, и мы не можем подтвердить бронирование по оплаченной цене. Деньги вернём полностью.',
    data_error: 'В данных бронирования обнаружена ошибка, из-за которой мы не можем его подтвердить. Деньги вернём полностью.',
    other: '',
};

const groupTitle = { ...text.caption, fontWeight: 600, letterSpacing: 0.4, textTransform: 'uppercase' as const, fontSize: 11 };

export default function RejectBookingDialog({ booking, mode = 'reject', onClose, onDone }: { booking: Booking; mode?: 'reject' | 'cancel'; onClose: () => void; onDone: (next: Booking) => void }) {
    const paid = Number(booking.paidAmount ?? booking.finalPrice) || 0;
    const [reason, setReason] = useState<BookingRejectReason>(mode === 'cancel' ? 'other' : 'no_availability');
    const [message, setMessage] = useState(mode === 'cancel' ? '' : DEFAULT_MESSAGES.no_availability);
    const [messageTouched, setMessageTouched] = useState(false);
    const [full, setFull] = useState(true);
    const [partial, setPartial] = useState('');
    const [refundDone, setRefundDone] = useState(false);
    const [notify, setNotify] = useState(true);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const isCancel = mode === 'cancel';

    const pickReason = (r: BookingRejectReason) => {
        setReason(r);
        if (!messageTouched) setMessage(DEFAULT_MESSAGES[r]);
    };

    const refundAmount = full ? paid : Number(String(partial).replace(/\s/g, '').replace(',', '.'));

    const submit = async () => {
        setError(null);
        if (!full && (!Number.isFinite(refundAmount) || refundAmount < 0 || refundAmount > paid)) {
            setError(`Сумма частичного возврата — от 0 до ${formatMoney(paid)}`);
            return;
        }
        setBusy(true);
        try {
            const body = { reason, message: message.trim() || null, refundAmount, refundDone, notify };
            const next = isCancel ? await cancelBooking(booking.bookingId, body) : await rejectBooking(booking.bookingId, body);
            onDone(next);
        } catch (e: any) {
            setError(e instanceof RoomsApiError ? e.message : e?.message || (isCancel ? 'Не удалось отменить бронирование' : 'Не удалось отклонить бронирование'));
        } finally {
            setBusy(false);
        }
    };

    const actionLabel = refundAmount > 0 ? (isCancel ? 'Отменить и вернуть деньги' : 'Отклонить и вернуть деньги') : isCancel ? 'Отменить бронирование' : 'Отклонить';

    return (
        <Modal title={`${isCancel ? 'Отменить' : 'Отклонить'} бронирование № ${booking.orderId}`} onClose={onClose} width={560}>
            <div style={{ display: 'grid', gap: 14 }}>
                <div style={{ ...text.body, marginTop: -8 }}>
                    {isCancel
                        ? 'Бронирование уже подтверждено — клиент получит уведомление об отмене, деньги возвращаем вручную.'
                        : 'Клиент получит уведомление, деньги возвращаем вручную (не через API банка).'}
                </div>

                <div style={{ display: 'grid', gap: 8 }}>
                    <div style={groupTitle}>Причина</div>
                    {BOOKING_REJECT_REASONS.map((r) => (
                        <label key={r.value} style={checkboxRow}>
                            <input type="radio" name="reject-reason" checked={reason === r.value} onChange={() => pickReason(r.value)} />
                            {r.label}
                        </label>
                    ))}
                </div>

                <Field label="Сообщение клиенту">
                    <textarea
                        style={{ ...textareaStyle, minHeight: 72 }}
                        value={message}
                        onChange={(e) => {
                            setMessage(e.target.value);
                            setMessageTouched(true);
                        }}
                        maxLength={4000}
                        placeholder="Текст попадёт в письмо и push клиенту"
                    />
                </Field>

                <div style={{ display: 'grid', gap: 10 }}>
                    <div style={groupTitle}>Возврат</div>
                    <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
                        <label style={checkboxRow}>
                            <input type="radio" name="refund-mode" checked={full} onChange={() => setFull(true)} />
                            Вернуть клиенту {formatMoney(paid)} (полностью)
                        </label>
                        <label style={{ ...checkboxRow, gap: 8 }}>
                            <input type="radio" name="refund-mode" checked={!full} onChange={() => setFull(false)} />
                            Частично
                            <input
                                type="number"
                                min={0}
                                max={paid}
                                step={1}
                                value={partial}
                                disabled={full}
                                onChange={(e) => setPartial(e.target.value)}
                                onFocus={() => setFull(false)}
                                placeholder="0 ₽"
                                style={{ ...compactInput, width: 120, padding: '6px 10px' }}
                            />
                        </label>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', fontSize: 13, color: t.textSecondary }}>
                        <span>Способ:</span>
                        <span style={{ padding: '4px 10px', borderRadius: radius.pill, background: t.surfaceInset, border: `1px solid ${t.border}`, color: t.textPrimary, fontWeight: 600 }}>
                            Вручную
                        </span>
                        <label style={checkboxRow}>
                            <input type="checkbox" checked={refundDone} onChange={(e) => setRefundDone(e.target.checked)} />
                            Возврат уже выполнен
                        </label>
                    </div>
                    <div style={text.caption}>
                        {refundDone
                            ? 'Клиент увидит «возврат выполнен». Отметить можно и позже — кнопкой в карточке бронирования.'
                            : 'Возврат останется «в обработке» — после перевода денег нажмите «Отметить возврат выполненным» в карточке.'}
                    </div>
                </div>

                <label style={checkboxRow}>
                    <input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} />
                    Уведомить клиента (push + e-mail)
                </label>

                <ErrorBox message={error} />

                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                    <button type="button" onClick={onClose} disabled={busy} style={button('secondary', 'md')}>Отмена</button>
                    <button type="button" onClick={submit} disabled={busy} style={{ ...button('danger', 'md'), background: t.error, color: t.textOnAccent, opacity: busy ? 0.6 : 1 }}>
                        {busy ? (isCancel ? 'Отменяем...' : 'Отклоняем...') : actionLabel}
                    </button>
                </div>
            </div>
        </Modal>
    );
}
