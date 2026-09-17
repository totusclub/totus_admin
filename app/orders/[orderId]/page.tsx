'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import PageShell from '@/components/PageShell';
import AdminNav from '@/components/AdminNav';
import Icon from '@/components/Icon';
import { t, radius, text, cardStyle, sectionTitle, button, badge } from '@/lib/theme';
import {
    getOrder,
    getOrderDocuments,
    getClientOrder,
    getOrderAuthToken,
    getInternalBookingId,
    isInternalOrder,
    collectLtDocuments,
    getPackageData,
    getOrderId,
    getOrderPrice,
    getStatusLabel,
    formatOrderDate,
    formatPeriod,
    formatPrice,
    isOrderAwaitingPayment,
    type Order,
} from '@/lib/orders-api';
import { getUserById, getUserDisplayName, type User } from '@/lib/users-api';

type StatusTone = 'success' | 'info' | 'warning' | 'error' | 'neutral';

/**
 * Тон плашки статуса для дизайн-системы: цвет приходит из badge(), а значение —
 * из состояния заказа. Оплачен/завершён — success, в работе — info,
 * ожидает оплаты — warning, отменён — error, остальное — neutral.
 */
function statusTone(status: string, awaitingPayment = false): StatusTone {
    const s = String(status || '').toLowerCase();
    if (/cancel|отмен|fail|reject|ошиб|отклон/.test(s)) return 'error';
    if (awaitingPayment || /pending|await|ожида|не оплач|unpaid/.test(s)) return 'warning';
    if (/paid|оплач|complet|reconcil|заверш|approve|подтвер/.test(s)) return 'success';
    if (/progress|process|в работе|обраб|брон|booking|confirm/.test(s)) return 'info';
    return 'neutral';
}

type Doc = { name?: string; url: string };

// Build a stable identity for a document so the same file from different sources
// (local /uploads copy vs remote Level Travel URL) is treated as one.
function docKey(doc: Doc): string {
    const url = String(doc.url || '').toLowerCase();
    const attachmentMatch = url.match(/\/attachment\/(\d+)/);
    if (attachmentMatch) return `attachment:${attachmentMatch[1]}`;
    if (url.includes('agreement.pdf') || url.includes('agreement_code=')) return 'agreement_doc';
    if (url.includes('license_agreement')) return 'agreement_license';

    // last path segment without query string
    const fileName = url.split('?')[0].split('/').filter(Boolean).pop() || '';
    if (fileName) return `file:${fileName}`;

    const name = String(doc.name || '').trim().toLowerCase();
    if (name) return `name:${name}`;
    return `url:${url}`;
}

// Merge + de-duplicate documents, preferring locally-stored copies (/uploads).
function dedupeDocuments(docs: Doc[]): Doc[] {
    const map = new Map<string, Doc>();
    for (const doc of docs) {
        if (!doc?.url) continue;
        const key = docKey(doc);
        const existing = map.get(key);
        if (!existing) {
            map.set(key, doc);
            continue;
        }
        // Prefer the local (already downloaded) copy over a remote one.
        const existingLocal = existing.url.includes('/uploads/');
        const incomingLocal = doc.url.includes('/uploads/');
        if (!existingLocal && incomingLocal) {
            map.set(key, doc);
        }
    }
    return Array.from(map.values());
}

// Safely turn any value (including objects like {id,name,logo}) into something renderable.
function renderValue(value: React.ReactNode): React.ReactNode {
    if (value === null || value === undefined || value === '') return '—';
    if (React.isValidElement(value)) return value;
    if (typeof value === 'object') {
        const obj: any = value;
        return obj.name ?? obj.title ?? obj.label ?? obj.value ?? JSON.stringify(obj);
    }
    return value as React.ReactNode;
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
    return (
        <div
            style={{
                display: 'flex',
                justifyContent: 'space-between',
                gap: 16,
                padding: '12px 0',
                borderBottom: `1px solid ${t.border}`,
            }}
        >
            <span style={{ ...text.body, color: t.textTertiary }}>{label}</span>
            <span style={{ ...text.body, color: t.textPrimary, fontWeight: 500, textAlign: 'right' }}>{renderValue(value)}</span>
        </div>
    );
}

export default function OrderDetailPage() {
    const params = useParams();
    const router = useRouter();
    const orderIdParam = Array.isArray(params.orderId) ? params.orderId[0] : params.orderId;

    const [order, setOrder] = useState<Order | null>(null);
    const [owner, setOwner] = useState<User | null>(null);
    const [documents, setDocuments] = useState<Array<{ name?: string; url: string }>>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Live Level Travel data
    const [ltOrder, setLtOrder] = useState<any>(null);
    const [ltLoading, setLtLoading] = useState(false);
    const [ltError, setLtError] = useState<string | null>(null);
    const [showRaw, setShowRaw] = useState(false);

    const loadLevelTravel = async (sourceOrder: Order | null) => {
        const base = sourceOrder || order;
        if (!base || !orderIdParam) return;
        // Внутренний заказ (бронирование Arlekino): Level.Travel не участвует — /client/orders/:id не вызываем.
        if (isInternalOrder(base, orderIdParam)) return;
        const token = getOrderAuthToken(base);
        if (!token) {
            setLtError('Для этого заказа нет auth_token Level Travel — токен не пришёл от Level.Travel при создании заказа');
            return;
        }
        try {
            setLtLoading(true);
            setLtError(null);
            const lt = await getClientOrder(orderIdParam, token, false);
            setLtOrder(lt);
            const ltDocs = collectLtDocuments(lt);
            if (ltDocs.length) {
                setDocuments((prev) => dedupeDocuments([...prev, ...ltDocs]));
            }
        } catch (e: any) {
            console.error('Failed to load Level Travel order:', e);
            setLtError(e?.message || 'Не удалось загрузить данные Level Travel');
        } finally {
            setLtLoading(false);
        }
    };

    useEffect(() => {
        const load = async () => {
            if (!orderIdParam) return;
            try {
                setLoading(true);
                setError(null);
                setLtOrder(null);
                setLtError(null);
                setDocuments([]);
                const data = await getOrder(orderIdParam);
                if ((data as any)?.error) {
                    throw new Error((data as any).error);
                }
                setOrder(data);

                getOrderDocuments(orderIdParam)
                    .then((docs) => setDocuments((prev) => dedupeDocuments([...prev, ...(docs as Doc[])])))
                    .catch(() => { /* keep whatever is already loaded */ });

                const uid = (data as any)?.user_id;
                if (uid != null) {
                    getUserById(Number(uid)).then(setOwner).catch(() => setOwner(null));
                }

                // Auto-load full Level Travel data when an auth token is available.
                loadLevelTravel(data);
            } catch (e: any) {
                console.error('Failed to load order:', e);
                setError(e?.message || 'Не удалось загрузить заказ');
            } finally {
                setLoading(false);
            }
        };
        load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [orderIdParam]);

    // Prefer live Level Travel data when available, fall back to DB package.
    const ltPkg = ltOrder ? (ltOrder.package || ltOrder) : null;
    const pkg = ltPkg || getPackageData(order || undefined);
    const lt = ltOrder || (order as any)?.package || {};
    const statusLabel = (ltOrder && (ltOrder.status_for_client || ltOrder.state)) || getStatusLabel(order || undefined);
    const hotelName = pkg?.hotel?.name || '';
    const destination = [pkg?.hotel?.city, pkg?.hotel?.country].filter(Boolean).join(', ');
    const tourists: any[] = pkg?.tourists || lt?.tourists || ltOrder?.tourists || [];
    const client = lt?.client || pkg?.client || ltOrder?.client;
    const awaiting = order ? isOrderAwaitingPayment(order) : false;
    const statusBadgeTone = statusTone(
        [pkg?.state, (order as any)?.state, statusLabel].filter(Boolean).join(' '),
        awaiting
    );
    const ltPrice = ltOrder
        ? formatPrice(ltOrder.full_price ?? ltOrder.price ?? ltPkg?.price ?? ltPkg?.full_price)
        : null;
    // Внутренний заказ наших Room Type (internal:true / totus_booking / id >= 900000000) — вместо блока Level Travel плашка Arlekino.
    const internal = order ? isInternalOrder(order, orderIdParam) : false;
    const internalBookingId = internal ? getInternalBookingId(order, orderIdParam) : null;
    const booking: any = (order as any)?.totus_booking || null;

    return (
        <PageShell>
            <AdminNav />

            <button onClick={() => router.back()} style={{ ...button('secondary', 'md'), width: 'fit-content' }}>
                <Icon name="arrowLeft" size={16} />
                Назад
            </button>

            {loading ? (
                <div style={{ ...cardStyle, ...text.body, color: t.textTertiary, textAlign: 'center' }}>Загрузка заказа...</div>
            ) : error ? (
                <div style={{ ...cardStyle, ...text.body, color: t.error, textAlign: 'center' }}>{error}</div>
            ) : !order ? (
                <div style={{ ...cardStyle, ...text.body, color: t.textTertiary, textAlign: 'center' }}>Заказ не найден</div>
            ) : (
                <>
                    {/* Header / summary */}
                    <div style={cardStyle}>
                        <div
                            style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                gap: 12,
                                flexWrap: 'wrap',
                                marginBottom: 16,
                            }}
                        >
                            <h1 style={{ ...text.pageTitle, margin: 0 }}>
                                Тур № {getOrderId(order)}
                            </h1>
                            <span style={{ ...badge(statusBadgeTone), whiteSpace: 'nowrap' }}>{statusLabel}</span>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                            <div style={text.sectionTitle}>{getOrderPrice(order)}</div>
                            {awaiting ? (
                                <span style={badge('warning')}>Ожидает оплаты</span>
                            ) : (
                                <span style={badge('success')}>Оплачено</span>
                            )}
                        </div>
                        <div style={{ ...text.caption, marginTop: 6 }}>
                            Создан: {formatOrderDate((order as any)?.c_date || pkg?.created_at)}
                            {(order as any)?.pay_status ? ` · pay_status: ${(order as any).pay_status}` : ''}
                        </div>
                    </div>

                    {/* Внутренний заказ: бронирование Arlekino, Level.Travel не участвует */}
                    {internal && (
                        <div style={cardStyle}>
                            <div
                                style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    gap: 12,
                                    flexWrap: 'wrap',
                                }}
                            >
                                <div>
                                    <div style={{ ...sectionTitle, marginBottom: 4 }}>Бронирование Arlekino — Level.Travel не участвует</div>
                                    <div style={text.caption}>
                                        Заказ нашего Room Type: оплата нашей цены, подтверждение и возврат — вручную сотрудником в разделе «Отели и номера».
                                        {booking?.statusLabel ? ` Статус: ${booking.statusLabel}.` : ''}
                                        {booking?.hotelBookingRef ? ` Номер брони: ${booking.hotelBookingRef}.` : ''}
                                    </div>
                                </div>
                                {internalBookingId != null && (
                                    <button
                                        onClick={() => router.push(`/rooms/booking/${internalBookingId}`)}
                                        style={button('primary', 'md')}
                                    >
                                        Открыть бронирование #{internalBookingId}
                                        <Icon name="chevronRight" size={16} />
                                    </button>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Level Travel live data */}
                    {!internal && (
                    <div style={cardStyle}>
                        <div
                            style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                gap: 12,
                                flexWrap: 'wrap',
                                marginBottom: ltOrder || ltError ? 14 : 0,
                            }}
                        >
                            <div>
                                <div style={{ ...sectionTitle, marginBottom: 4 }}>Данные Level Travel</div>
                                <div style={text.caption}>
                                    {ltLoading
                                        ? 'Загрузка из Level Travel...'
                                        : ltOrder
                                            ? 'Актуальные данные получены напрямую из Level Travel'
                                            : 'Полная информация о заказе из Level Travel'}
                                </div>
                            </div>
                            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                {getOrderAuthToken(order) && (
                                    <button
                                        onClick={() =>
                                            router.push(`/lt-orders?token=${encodeURIComponent(getOrderAuthToken(order) || '')}`)
                                        }
                                        style={button('secondary', 'md')}
                                    >
                                        Все заказы клиента в LT
                                        <Icon name="chevronRight" size={16} />
                                    </button>
                                )}
                                <button
                                    onClick={() => loadLevelTravel(order)}
                                    disabled={ltLoading}
                                    style={{
                                        ...button('primary', 'md'),
                                        cursor: ltLoading ? 'not-allowed' : 'pointer',
                                        opacity: ltLoading ? 0.6 : 1,
                                    }}
                                >
                                    <Icon name="refresh" size={16} />
                                    {ltLoading ? 'Загрузка...' : ltOrder ? 'Обновить из LT' : 'Загрузить из LT'}
                                </button>
                            </div>
                        </div>

                        {ltError && !ltOrder && (
                            <div style={{ ...text.body, color: t.error, marginTop: 12 }}>{ltError}</div>
                        )}

                        {ltOrder && (
                            <>
                                <InfoRow label="LT order id" value={ltOrder.id} />
                                <InfoRow label="Состояние (state)" value={ltOrder.state} />
                                <InfoRow label="Статус для клиента" value={ltOrder.status_for_client} />
                                <InfoRow label="Стоимость (LT)" value={ltPrice} />
                                <InfoRow
                                    label="Оплачено"
                                    value={ltOrder.is_paid === true ? 'Да' : ltOrder.is_paid === false ? 'Нет' : undefined}
                                />
                                <InfoRow
                                    label="Вложений (документов)"
                                    value={Array.isArray(ltOrder.attachments) ? ltOrder.attachments.length : 0}
                                />

                                <button
                                    onClick={() => setShowRaw((v) => !v)}
                                    style={{ ...button('tertiary', 'sm'), marginTop: 14 }}
                                >
                                    <Icon name="eye" size={16} />
                                    {showRaw ? 'Скрыть полный JSON' : 'Показать полный JSON'}
                                </button>
                                {showRaw && (
                                    <pre
                                        style={{
                                            ...text.mono,
                                            marginTop: 12,
                                            padding: 16,
                                            borderRadius: radius.md,
                                            background: t.surfaceInset,
                                            border: `1px solid ${t.border}`,
                                            color: t.textSecondary,
                                            maxHeight: 400,
                                            overflow: 'auto',
                                            whiteSpace: 'pre-wrap',
                                            wordBreak: 'break-word',
                                        }}
                                    >
                                        {JSON.stringify(ltOrder, null, 2)}
                                    </pre>
                                )}
                            </>
                        )}
                    </div>
                    )}

                    {/* Tour info */}
                    <div style={cardStyle}>
                        <div style={sectionTitle}>Информация о туре</div>
                        <InfoRow label="Отель" value={hotelName} />
                        <InfoRow label="Курорт" value={destination} />
                        <InfoRow label="Период" value={formatPeriod(pkg)} />
                        <InfoRow label="Ночей" value={pkg?.nights_count} />
                        <InfoRow label="Тип номера" value={pkg?.room_type} />
                        <InfoRow label="Питание" value={pkg?.pansion_description || pkg?.meal} />
                        <InfoRow label="Туроператор" value={pkg?.operator || (internal ? 'Arlekino' : 'Level.Travel')} />
                    </div>

                    {/* Client */}
                    {(client || owner) && (
                        <div style={cardStyle}>
                            <div style={sectionTitle}>Клиент</div>
                            {owner && (
                                <InfoRow
                                    label="Пользователь"
                                    value={
                                        <button
                                            onClick={() => router.push(`/orders?userId=${owner.id}`)}
                                            style={{ ...button('tertiary', 'sm'), color: t.accent, padding: 0 }}
                                        >
                                            {getUserDisplayName(owner)} (ID {owner.loyaltyId})
                                            <Icon name="chevronRight" size={16} />
                                        </button>
                                    }
                                />
                            )}
                            {client && (
                                <>
                                    <InfoRow label="Имя" value={[client?.name, client?.surname].filter(Boolean).join(' ')} />
                                    <InfoRow label="Email" value={client?.email} />
                                    <InfoRow label="Телефон" value={client?.phone} />
                                </>
                            )}
                        </div>
                    )}

                    {/* Tourists */}
                    {tourists.length > 0 && (
                        <div style={cardStyle}>
                            <div style={sectionTitle}>Туристы ({tourists.length})</div>
                            <div style={{ display: 'grid', gap: 10 }}>
                                {tourists.map((tourist, idx) => (
                                    <div
                                        key={tourist?.id ?? idx}
                                        style={{
                                            padding: '12px 14px',
                                            borderRadius: radius.md,
                                            background: t.surfaceInset,
                                            border: `1px solid ${t.border}`,
                                        }}
                                    >
                                        <div style={{ ...text.body, color: t.textPrimary, fontWeight: 600, marginBottom: 4 }}>
                                            {[tourist?.surname, tourist?.name].filter(Boolean).join(' ') || `Турист ${idx + 1}`}
                                        </div>
                                        <div style={{ ...text.caption, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                                            {tourist?.birthday && <span>Дата рожд.: {tourist.birthday}</span>}
                                            {tourist?.passport && <span>Паспорт: {tourist.passport}</span>}
                                            {tourist?.passport_expires_on && <span>Действ. до: {tourist.passport_expires_on}</span>}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Documents */}
                    {documents.length > 0 && (
                        <div style={cardStyle}>
                            <div style={sectionTitle}>Документы</div>
                            <div style={{ display: 'grid', gap: 8 }}>
                                {documents.map((doc, idx) => (
                                    <a
                                        key={idx}
                                        href={doc.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        style={{
                                            ...text.body,
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 10,
                                            padding: '12px 14px',
                                            borderRadius: radius.md,
                                            background: t.surfaceInset,
                                            border: `1px solid ${t.border}`,
                                            color: t.textSecondary,
                                            textDecoration: 'none',
                                        }}
                                    >
                                        <Icon name="file" size={18} />
                                        {doc.name || `Документ ${idx + 1}`}
                                    </a>
                                ))}
                            </div>
                        </div>
                    )}
                </>
            )}
        </PageShell>
    );
}
