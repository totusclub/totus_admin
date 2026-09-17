'use client';

// Вкладка «Наши Room Type» (все отели): таблица GET /room-types с фильтрами и действиями.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { t, text, button } from '@/lib/theme';
import { ErrorBox, SuccessBox, StatusBadge, compactInput, selectStyle } from '@/components/notifications/shared';
import { listRoomTypes, toggleRoomType, deleteRoomType, formatMoney, type RoomType } from '@/lib/rooms-api';
import DuplicateDialog from './DuplicateDialog';
import { STATUS_META, roomTypeStatus, type ListStatus, roomTypeLabel, formatShortDateTime, Stars, Empty, Spinner, ConfirmDialog, TableWrap, tableStyle, thStyle, tdStyle, tdRight, thRight, useDebounced } from './shared';

const STATUS_OPTIONS: { value: ListStatus | ''; label: string }[] = [
    { value: '', label: 'Все статусы' },
    { value: 'fixed', label: 'Активен · фикс. цена' },
    { value: 'active', label: 'Активен · правило' },
    { value: 'never_seen', label: 'Ещё не показывался' },
    { value: 'inactive', label: 'Выкл' },
    { value: 'source_missing', label: 'Источник не найден' },
    { value: 'margin_clamped', label: 'Маржа ограничена' },
];

export default function RoomTypesTab({ hotelId }: { hotelId?: number }) {
    const router = useRouter();
    const [items, setItems] = useState<RoomType[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [notice, setNotice] = useState<string | null>(null);
    const [hotelFilter, setHotelFilter] = useState<string>(hotelId ? String(hotelId) : '');
    const [status, setStatus] = useState<ListStatus | ''>('');
    const [q, setQ] = useState('');
    const debouncedQ = useDebounced(q, 350);
    const [busyId, setBusyId] = useState<number | null>(null);
    const [duplicate, setDuplicate] = useState<RoomType | null>(null);
    const [removing, setRemoving] = useState<RoomType | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await listRoomTypes({ hotelId: hotelFilter || undefined, q: debouncedQ.trim() || undefined });
            setItems(data.room_types || []);
        } catch (e: any) {
            setError(e?.message || 'Не удалось загрузить Room Type');
        } finally {
            setLoading(false);
        }
    }, [hotelFilter, debouncedQ]);

    useEffect(() => {
        load();
    }, [load]);

    // Список отелей для фильтра — из самой выдачи (сервер фильтрует по hotel_id).
    const [hotels, setHotels] = useState<{ id: number; name: string }[]>([]);
    useEffect(() => {
        if (hotelFilter) return;
        const map = new Map<number, string>();
        items.forEach((rt) => map.set(rt.hotelId, rt.hotelName || `Отель #${rt.hotelId}`));
        setHotels([...map.entries()].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name, 'ru')));
    }, [items, hotelFilter]);

    const visible = useMemo(() => items.filter((rt) => !status || roomTypeStatus(rt) === status), [items, status]);

    const patch = (next: RoomType) => setItems((list) => list.map((x) => (x.id === next.id ? { ...x, ...next } : x)));

    const onToggle = async (rt: RoomType) => {
        setBusyId(rt.id);
        setError(null);
        try {
            patch(await toggleRoomType(rt.id));
        } catch (e: any) {
            setError(e?.message || 'Не удалось переключить');
        } finally {
            setBusyId(null);
        }
    };

    const onDelete = async () => {
        if (!removing) return;
        setBusyId(removing.id);
        try {
            await deleteRoomType(removing.id);
            setItems((list) => list.filter((x) => x.id !== removing.id));
            setNotice(`Room Type «${removing.content?.nameRu}» удалён`);
            setRemoving(null);
        } catch (e: any) {
            setError(e?.message || 'Не удалось удалить');
        } finally {
            setBusyId(null);
        }
    };

    return (
        <div style={{ display: 'grid', gap: 14 }}>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                {!hotelId ? (
                    <select style={{ ...selectStyle, width: 260 }} value={hotelFilter} onChange={(e) => setHotelFilter(e.target.value)}>
                        <option value="">Все отели</option>
                        {hotels.map((h) => (
                            <option key={h.id} value={h.id}>{h.name}</option>
                        ))}
                    </select>
                ) : null}
                <select style={{ ...selectStyle, width: 200 }} value={status} onChange={(e) => setStatus(e.target.value as ListStatus | '')}>
                    {STATUS_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                </select>
                <input style={{ ...compactInput, width: 260 }} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Поиск по названию, отелю, номеру" />
                <div style={{ flex: 1 }} />
                <button type="button" onClick={load} disabled={loading} style={button('secondary', 'sm')}>Обновить</button>
            </div>

            <ErrorBox message={error} />
            <SuccessBox message={notice} />

            {loading ? <Spinner label="Загружаем Room Type..." /> : null}

            {!loading && visible.length === 0 ? (
                <Empty title="Room Type пока нет" hint="Найдите отель на вкладке «Отели», откройте номер Level.Travel и нажмите «Создать Room Type»" />
            ) : null}

            {!loading && visible.length > 0 ? (
                <TableWrap>
                    <table style={tableStyle}>
                        <thead>
                            <tr>
                                <th style={thStyle}>Отель</th>
                                <th style={thStyle}>Оператор</th>
                                <th style={thStyle}>Номер-источник</th>
                                <th style={thStyle}>Room Type</th>
                                <th style={thStyle}>Цена</th>
                                <th style={thRight}>Цена LT</th>
                                <th style={thRight}>Наша</th>
                                <th style={thRight}>Маржа</th>
                                <th style={thStyle}>Обновлено</th>
                                <th style={thRight}>Заказов</th>
                                <th style={thStyle}>Статус</th>
                                <th style={thStyle} />
                            </tr>
                        </thead>
                        <tbody>
                            {visible.map((rt) => {
                                const st = STATUS_META[roomTypeStatus(rt)];
                                const fixed = rt.pricingMode === 'fixed';
                                const provider = rt.last?.providerPrice;
                                // v2: fixed — наша цена известна всегда (previewPrice); rule — последняя показанная, иначе расчёт от last
                                const final = fixed ? (rt.previewPrice ?? rt.fixedPrice ?? null) : (rt.last?.finalPrice ?? rt.previewPrice ?? null);
                                const margin = provider != null && final != null ? final - provider : null;
                                const busy = busyId === rt.id;
                                return (
                                    <tr key={rt.id}>
                                        <td style={tdStyle}>
                                            <div style={{ fontWeight: 600 }}>{rt.hotelName || `Отель #${rt.hotelId}`}</div>
                                            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                                                <Stars count={rt.hotelStars || 0} size={11} />
                                                <span style={text.caption}>{rt.hotelCity || ''}</span>
                                            </div>
                                        </td>
                                        <td style={tdStyle}>
                                            <div style={{ fontWeight: 600 }}>{rt.operatorName || 'Arlekino'}</div>
                                            {rt.operatorIds?.length ? <div style={text.caption}>шаблон: {rt.operatorNames?.length ? rt.operatorNames.join(', ') : rt.operatorIds.join(', ')}</div> : null}
                                        </td>
                                        <td style={{ ...tdStyle, color: t.textSecondary }}>{rt.sourceRoomName || `#${rt.sourceRoomId}`}</td>
                                        <td style={tdStyle}>
                                            <div style={{ fontWeight: 600 }}>{rt.content?.nameRu}</div>
                                            {rt.mealTypes?.length ? <div style={text.caption}>{rt.mealTypes.join(', ')}</div> : null}
                                        </td>
                                        <td style={{ ...tdStyle, whiteSpace: 'nowrap' }}>
                                            <div style={{ fontWeight: fixed ? 600 : 400 }}>{roomTypeLabel(rt)}</div>
                                            <div style={text.caption}>{fixed ? (rt.fixedPriceUnit === 'per_night' ? 'за ночь' : 'за проживание') : 'от цены LT'}</div>
                                        </td>
                                        <td style={tdRight}>{formatMoney(provider)}</td>
                                        <td style={{ ...tdRight, fontWeight: 600 }}>{formatMoney(final)}</td>
                                        <td style={{ ...tdRight, color: margin == null ? t.textTertiary : margin < 0 ? t.error : t.success }}>{formatMoney(margin, true)}</td>
                                        <td style={{ ...tdStyle, whiteSpace: 'nowrap', color: t.textSecondary }}>{formatShortDateTime(rt.last?.seenAt)}</td>
                                        <td style={tdRight}>{rt.ordersCount ?? '—'}</td>
                                        <td style={tdStyle}><StatusBadge label={st.label} tone={st.tone} /></td>
                                        <td style={{ ...tdStyle, whiteSpace: 'nowrap' }}>
                                            <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                                                <button type="button" onClick={() => router.push(`/rooms/room-type/${rt.id}`)} style={button('secondary', 'sm')}>Открыть</button>
                                                <button type="button" onClick={() => onToggle(rt)} disabled={busy} style={button('tertiary', 'sm')}>{rt.active ? 'Выкл' : 'Вкл'}</button>
                                                <button type="button" onClick={() => setDuplicate(rt)} disabled={busy} style={button('tertiary', 'sm')}>Дублировать</button>
                                                <button type="button" onClick={() => setRemoving(rt)} disabled={busy} style={{ ...button('tertiary', 'sm'), color: t.error }}>Удалить</button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </TableWrap>
            ) : null}

            {duplicate ? (
                <DuplicateDialog
                    roomType={duplicate}
                    onClose={() => setDuplicate(null)}
                    onDone={(copy, openEditor) => {
                        setDuplicate(null);
                        setItems((list) => [copy, ...list]);
                        setNotice(`Копия «${copy.content?.nameRu}» создана (выключена)`);
                        if (openEditor) router.push(`/rooms/room-type/${copy.id}`);
                    }}
                />
            ) : null}

            {removing ? (
                <ConfirmDialog
                    title="Удалить Room Type?"
                    message={<>«{removing.content?.nameRu}» исчезнет с витрины, история цен и правок будет удалена. Заказы не затрагиваются.</>}
                    busy={busyId === removing.id}
                    onConfirm={onDelete}
                    onClose={() => setRemoving(null)}
                />
            ) : null}
        </div>
    );
}
