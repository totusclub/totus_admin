'use client';

// Модал «Подтвердить бронирование № …?» (макет 2141:105678): сводка, чекбокс уведомления,
// номер брони у отеля, загрузка ваучера PDF (отдельный запрос до confirm — уйдёт с письмом), комментарий клиенту.

import { useRef, useState, type DragEvent } from 'react';
import Icon from '@/components/Icon';
import { t, radius, text, button, textareaStyle } from '@/lib/theme';
import { Modal, Field, ErrorBox, compactInput, checkboxRow } from '@/components/notifications/shared';
import { confirmBooking, uploadBookingVoucher, formatMoney, RoomsApiError, type Booking } from '@/lib/rooms-api';
import { formatDateRange, formatShortDateTime, mealLabel } from './shared';
import { touristsLine } from './BookingStatusBadge';

const MAX_VOUCHER = 10 * 1024 * 1024;

function SummaryRow({ label, value }: { label: string; value: string }) {
    return (
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, fontSize: 13, lineHeight: '20px' }}>
            <span style={{ color: t.textTertiary, flexShrink: 0 }}>{label}</span>
            <span style={{ color: t.textPrimary, fontWeight: 600, textAlign: 'right' }}>{value}</span>
        </div>
    );
}

export default function ConfirmBookingDialog({ booking, onClose, onDone }: { booking: Booking; onClose: () => void; onDone: (next: Booking) => void }) {
    const [notify, setNotify] = useState(true);
    const [ref, setRef] = useState(booking.hotelBookingRef || '');
    const [message, setMessage] = useState(booking.clientMessage || '');
    const [file, setFile] = useState<File | null>(null);
    const [drag, setDrag] = useState(false);
    const [busy, setBusy] = useState<'' | 'upload' | 'confirm'>('');
    const [error, setError] = useState<string | null>(null);
    const inputRef = useRef<HTMLInputElement | null>(null);

    const pickFile = (f: File | null | undefined) => {
        setError(null);
        if (!f) return;
        const isPdf = f.type === 'application/pdf' || /\.pdf$/i.test(f.name);
        if (!isPdf) {
            setError('Допустим только PDF');
            return;
        }
        if (f.size > MAX_VOUCHER) {
            setError('Файл ваучера больше 10 МБ');
            return;
        }
        setFile(f);
    };

    const onDrop = (e: DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        setDrag(false);
        pickFile(e.dataTransfer?.files?.[0]);
    };

    const submit = async () => {
        setError(null);
        try {
            if (file) {
                setBusy('upload');
                await uploadBookingVoucher(booking.bookingId, file);
            }
            setBusy('confirm');
            const next = await confirmBooking(booking.bookingId, { hotelBookingRef: ref.trim() || null, clientMessage: message.trim() || null, notify });
            onDone(next);
        } catch (e: any) {
            setError(e instanceof RoomsApiError ? e.message : e?.message || 'Не удалось подтвердить бронирование');
        } finally {
            setBusy('');
        }
    };

    const hasVoucher = Boolean(booking.voucher);

    return (
        <Modal title={`Подтвердить бронирование № ${booking.orderId}?`} onClose={onClose} width={560}>
            <div style={{ display: 'grid', gap: 14 }}>
                <div style={{ ...text.body, marginTop: -8 }}>Клиент получит статус «Подтверждено» и ваучер. Level.Travel не участвует.</div>

                <div style={{ display: 'grid', gap: 4, padding: '12px 14px', borderRadius: radius.md, background: t.surfaceInset, border: `1px solid ${t.border}` }}>
                    <SummaryRow label="Отель" value={[booking.hotel?.name ? `${booking.hotel.name}${booking.hotel.stars ? ` ${booking.hotel.stars}*` : ''}` : '—', booking.hotel?.city].filter(Boolean).join(' · ')} />
                    <SummaryRow label="Номер" value={[booking.room || '—', booking.meal ? mealLabel(booking.meal).split(' · ')[0] : '', booking.operator].filter(Boolean).join(' · ')} />
                    <SummaryRow label="Даты" value={[formatDateRange(booking.checkIn, booking.nights), booking.nights ? `${booking.nights} ноч.` : '', touristsLine(booking).split(' · ')[0]].filter(Boolean).join(' · ')} />
                    <SummaryRow label="Клиент" value={[booking.customer?.name, booking.customer?.phone].filter(Boolean).join(' · ') || '—'} />
                    <SummaryRow label="Оплачено" value={`${formatMoney(booking.paidAmount ?? booking.finalPrice)} · СБП · ${formatShortDateTime(booking.paidAt)}`} />
                </div>

                <label style={checkboxRow}>
                    <input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} />
                    Отправить клиенту подтверждение (push + e-mail)
                </label>

                <Field label="Номер подтверждения / бронь у отеля (необязательно)">
                    <input style={compactInput} value={ref} onChange={(e) => setRef(e.target.value)} placeholder="HTL-7781" maxLength={128} />
                </Field>

                <div
                    role="button"
                    tabIndex={0}
                    onClick={() => inputRef.current?.click()}
                    onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ' ? inputRef.current?.click() : undefined)}
                    onDragOver={(e) => {
                        e.preventDefault();
                        setDrag(true);
                    }}
                    onDragLeave={() => setDrag(false)}
                    onDrop={onDrop}
                    style={{
                        padding: '18px 16px',
                        textAlign: 'center',
                        borderRadius: radius.md,
                        border: `1px dashed ${drag ? t.accent : t.borderStrong}`,
                        background: drag ? t.accentSoft : t.surface,
                        cursor: 'pointer',
                    }}
                >
                    <input ref={inputRef} type="file" accept="application/pdf,.pdf" hidden onChange={(e) => pickFile(e.target.files?.[0])} />
                    <Icon name={file ? 'file' : 'upload'} size={20} style={{ color: t.accent, margin: '0 auto 6px' }} />
                    <div style={{ ...text.cardTitle, fontSize: 14 }}>
                        {file ? file.name : hasVoucher ? 'Заменить ваучер (PDF)' : 'Загрузить ваучер (PDF)'}
                    </div>
                    <div style={text.caption}>
                        {file
                            ? `${(file.size / 1024).toFixed(0)} КБ · нажмите, чтобы выбрать другой`
                            : hasVoucher
                                ? 'Ваучер уже загружен и уйдёт клиенту с подтверждением'
                                : 'Перетащите файл или нажмите, до 10 МБ. Можно загрузить позже'}
                    </div>
                </div>

                <Field label="Комментарий клиенту (необязательно)">
                    <textarea style={{ ...textareaStyle, minHeight: 72 }} value={message} onChange={(e) => setMessage(e.target.value)} maxLength={4000} placeholder="Номер на верхнем этаже подтверждён отелем" />
                </Field>

                <ErrorBox message={error} />

                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                    <button type="button" onClick={onClose} disabled={Boolean(busy)} style={button('secondary', 'md')}>Отмена</button>
                    <button type="button" onClick={submit} disabled={Boolean(busy)} style={{ ...button('primary', 'md'), opacity: busy ? 0.6 : 1 }}>
                        <Icon name="check" size={16} />
                        {busy === 'upload' ? 'Загружаем ваучер...' : busy === 'confirm' ? 'Подтверждаем...' : 'Подтвердить'}
                    </button>
                </div>
            </div>
        </Modal>
    );
}
