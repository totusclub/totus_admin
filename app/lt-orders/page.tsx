'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import PageShell from '@/components/PageShell';
import AdminNav from '@/components/AdminNav';
import Icon from '@/components/Icon';
import { t, radius, text, cardStyle, inputStyle, button, badge } from '@/lib/theme';
import {
    getClientOrders,
    getClientOrder,
    getOrder,
    getOrderAuthToken,
    getInternalBookingId,
    isInternalOrder,
    getPackageData,
    getOrderId,
    getOrderPrice,
    formatPeriod,
    formatPrice,
} from '@/lib/orders-api';

const PAGE_LIMIT = 5;

// Токен Level Travel берётся только у конкретного заказа (GET /orders?order_id → lt_auth_token)
// или из URL (?token= — со страницы заказа, «Все заказы клиента в LT»). Чужие токены и обход
// всех пользователей (N × /user/orders) не используются: без номера заказа список не грузится.

function LtOrdersContent() {
    const router = useRouter();
    const searchParams = useSearchParams();

    const [pageNumber, setPageNumber] = useState(0);
    const [orders, setOrders] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [loaded, setLoaded] = useState(false);
    const [token, setToken] = useState<string | null>(null);
    const [searchId, setSearchId] = useState(() => searchParams.get('order_id') || '');
    const [searchActive, setSearchActive] = useState(false);
    // Внутренний заказ (бронирование Arlekino) — Level Travel не участвует, показываем ссылку на бронирование.
    const [internalBookingId, setInternalBookingId] = useState<number | null>(null);

    // Единственный источник токена без поиска — URL (?token= со страницы конкретного заказа).
    const resolveToken = (): string | null => {
        const urlToken = searchParams.get('token');
        return urlToken || null;
    };

    const load = async (page = 0, knownToken?: string) => {
        try {
            setLoading(true);
            setError(null);
            setSearchActive(false);
            setInternalBookingId(null);
            const activeToken = knownToken || token || resolveToken();
            if (!activeToken) {
                // Без токена конкретного заказа список не грузим — подсказка «введите номер заказа».
                setOrders([]);
                setLoaded(false);
                return;
            }
            if (activeToken !== token) setToken(activeToken);
            const { orders: list } = await getClientOrders(activeToken, page, PAGE_LIMIT);
            setOrders(list);
            setPageNumber(page);
            setLoaded(true);
        } catch (e: any) {
            console.error('Failed to load Level Travel orders:', e);
            setError(e?.message || 'Не удалось загрузить заказы Level Travel');
            setOrders([]);
            setLoaded(true);
        } finally {
            setLoading(false);
        }
    };

    const searchByOrderId = async () => {
        const id = searchId.trim();
        if (!id) {
            load(0);
            return;
        }
        try {
            setLoading(true);
            setError(null);
            setInternalBookingId(null);
            // Токен только этого заказа: GET /orders?order_id → lt_auth_token (строка заказа в БД).
            const dbOrder = await getOrder(id);
            if ((dbOrder as any)?.error) {
                throw new Error(String((dbOrder as any).error));
            }
            if (isInternalOrder(dbOrder, id)) {
                setInternalBookingId(getInternalBookingId(dbOrder, id));
                setOrders([]);
                setSearchActive(true);
                setLoaded(true);
                return;
            }
            const activeToken = getOrderAuthToken(dbOrder);
            if (!activeToken) {
                setError(`Для заказа № ${id} нет auth_token Level Travel — токен не пришёл от Level.Travel при создании заказа`);
                setOrders([]);
                setSearchActive(true);
                setLoaded(true);
                return;
            }
            if (activeToken !== token) setToken(activeToken);
            const found = await getClientOrder(id, activeToken, false);
            setOrders(found ? [found] : []);
            setSearchActive(true);
            setLoaded(true);
        } catch (e: any) {
            console.error('Failed to search Level Travel order:', e);
            setError(e?.message || `Заказ № ${id} не найден`);
            setOrders([]);
            setSearchActive(true);
            setLoaded(true);
        } finally {
            setLoading(false);
        }
    };

    const clearSearch = () => {
        setSearchId('');
        setInternalBookingId(null);
        // Список клиента доступен только с токеном найденного заказа / из URL — иначе снова подсказка.
        load(0);
    };

    useEffect(() => {
        if (searchParams.get('order_id')) {
            searchByOrderId();
        } else {
            load(0);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const prevDisabled = loading || pageNumber === 0;
    const nextDisabled = loading || orders.length < PAGE_LIMIT;

    return (
        <PageShell>
            <AdminNav />

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
                        <h1 style={{ ...text.pageTitle, margin: '0 0 6px' }}>
                            Заказы Level Travel
                        </h1>
                        <div style={{ ...text.caption, fontWeight: 500 }}>
                            Заказы напрямую из Level Travel (GET /client/orders) — по auth_token конкретного заказа
                        </div>
                    </div>
                    {!searchActive && token && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <button
                                onClick={() => load(Math.max(0, pageNumber - 1))}
                                disabled={prevDisabled}
                                style={{
                                    ...button('secondary', 'sm'),
                                    borderRadius: radius.pill,
                                    color: pageNumber === 0 ? t.textDisabled : t.textSecondary,
                                    cursor: prevDisabled ? 'not-allowed' : 'pointer',
                                }}
                            >
                                <Icon name="arrowLeft" size={16} />
                                Назад
                            </button>
                            <span style={text.caption}>Стр. {pageNumber + 1}</span>
                            <button
                                onClick={() => load(pageNumber + 1)}
                                disabled={nextDisabled}
                                style={{
                                    ...button('secondary', 'sm'),
                                    borderRadius: radius.pill,
                                    color: orders.length < PAGE_LIMIT ? t.textDisabled : t.textSecondary,
                                    cursor: nextDisabled ? 'not-allowed' : 'pointer',
                                }}
                            >
                                Вперёд
                                <Icon name="chevronRight" size={16} />
                            </button>
                            <button
                                onClick={() => load(pageNumber)}
                                disabled={loading}
                                style={{
                                    ...button('secondary', 'sm'),
                                    borderRadius: radius.pill,
                                    background: t.accentSoft,
                                    border: `1px solid ${t.accentBorder}`,
                                    color: t.accent,
                                    cursor: loading ? 'not-allowed' : 'pointer',
                                }}
                            >
                                <Icon name="refresh" size={16} />
                                {loading ? 'Загрузка...' : 'Обновить'}
                            </button>
                        </div>
                    )}
                </div>

                {/* Search by order id */}
                <div style={{ display: 'flex', gap: 8, marginTop: 18, flexWrap: 'wrap' }}>
                    <input
                        value={searchId}
                        onChange={(e) => setSearchId(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && searchByOrderId()}
                        placeholder="Поиск по номеру заказа..."
                        inputMode="numeric"
                        style={{
                            ...inputStyle,
                            flex: '1 1 260px',
                            width: 'auto',
                            minWidth: 200,
                            background: t.surfaceInset,
                            outline: 'none',
                        }}
                    />
                    <button
                        onClick={searchByOrderId}
                        disabled={loading}
                        style={{
                            ...button('primary', 'md'),
                            cursor: loading ? 'not-allowed' : 'pointer',
                            opacity: loading ? 0.6 : 1,
                        }}
                    >
                        <Icon name="search" size={16} />
                        Найти
                    </button>
                    {searchActive && (
                        <button
                            onClick={clearSearch}
                            disabled={loading}
                            style={{
                                ...button('secondary', 'md'),
                                cursor: loading ? 'not-allowed' : 'pointer',
                            }}
                        >
                            <Icon name="close" size={16} />
                            Сбросить
                        </button>
                    )}
                </div>

                {!loading && !loaded && !error && !internalBookingId && (
                    <div
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            marginTop: 16,
                            padding: '10px 12px',
                            borderRadius: radius.sm,
                            background: t.surfaceInset,
                            border: `1px solid ${t.border}`,
                            color: t.textSecondary,
                            fontSize: 13,
                            lineHeight: '18px',
                        }}
                    >
                        <Icon name="info" size={16} />
                        <span>
                            Введите номер заказа — данные запрашиваются у Level Travel по auth_token этого заказа
                            (GET /orders?order_id → lt_auth_token). Список всех заказов клиента открывается со страницы заказа.
                        </span>
                    </div>
                )}

                {internalBookingId != null && (
                    <div
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            marginTop: 16,
                            padding: '10px 12px',
                            borderRadius: radius.sm,
                            background: t.accentSoft,
                            border: `1px solid ${t.accentBorder}`,
                            color: t.textPrimary,
                            fontSize: 13,
                            lineHeight: '18px',
                            flexWrap: 'wrap',
                        }}
                    >
                        <Icon name="info" size={16} />
                        <span>Бронирование Arlekino — Level.Travel не участвует.</span>
                        <button
                            onClick={() => router.push(`/rooms/booking/${internalBookingId}`)}
                            style={{ ...button('tertiary', 'sm'), color: t.accent, padding: 0 }}
                        >
                            Открыть бронирование #{internalBookingId}
                            <Icon name="chevronRight" size={16} />
                        </button>
                    </div>
                )}

                {error && (
                    <div
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            marginTop: 16,
                            padding: '10px 12px',
                            borderRadius: radius.sm,
                            background: t.errorSoft,
                            border: `1px solid ${t.error}`,
                            color: t.error,
                            fontSize: 13,
                            lineHeight: '18px',
                        }}
                    >
                        <Icon name="info" size={16} />
                        <span>{error}</span>
                    </div>
                )}
            </div>

            {loaded && !error && internalBookingId == null && (
                <div style={cardStyle}>
                    <div style={{ ...text.cardTitle, marginBottom: 16 }}>
                        {searchActive
                            ? `Результат поиска: ${orders.length}`
                            : `Заказов на странице: ${orders.length}`}
                    </div>

                    {orders.length === 0 ? (
                        <div style={{ padding: 24, textAlign: 'center', ...text.body, color: t.textTertiary }}>
                            Заказы не найдены
                        </div>
                    ) : (
                        <div style={{ display: 'grid', gap: 12 }}>
                            {orders.map((order, idx) => {
                                const pkg = getPackageData(order) || order.package || order;
                                const orderId = getOrderId(order);
                                const statusLabel = order.status_for_client || order.state || '—';
                                const hotelName = pkg?.hotel?.name || '';
                                const location = pkg?.hotel
                                    ? [pkg.hotel.city, pkg.hotel.country].filter(Boolean).join(', ')
                                    : '';
                                const period = formatPeriod(pkg);
                                const price =
                                    formatPrice(order.full_price ?? order.price ?? pkg?.price ?? pkg?.full_price) ||
                                    getOrderPrice(order);

                                return (
                                    <div
                                        key={`${orderId}-${idx}`}
                                        onClick={() => orderId != null && router.push(`/orders/${orderId}`)}
                                        style={{
                                            padding: '18px 20px',
                                            borderRadius: radius.md,
                                            border: `1px solid ${t.border}`,
                                            background: t.surfaceInset,
                                            cursor: orderId != null ? 'pointer' : 'default',
                                            transition: 'transform 0.2s, box-shadow 0.2s, background 0.2s',
                                        }}
                                        onMouseEnter={(e) => {
                                            e.currentTarget.style.transform = 'translateY(-2px)';
                                            e.currentTarget.style.boxShadow = t.shadowRaised;
                                        }}
                                        onMouseLeave={(e) => {
                                            e.currentTarget.style.transform = 'translateY(0)';
                                            e.currentTarget.style.boxShadow = 'none';
                                        }}
                                    >
                                        <div
                                            style={{
                                                display: 'flex',
                                                justifyContent: 'space-between',
                                                alignItems: 'center',
                                                gap: 12,
                                                marginBottom: 8,
                                            }}
                                        >
                                            <div style={{ ...text.cardTitle, display: 'flex', alignItems: 'center', gap: 8 }}>
                                                <Icon name="luggage" size={18} style={{ color: t.accent }} />
                                                Тур <span style={{ color: t.textTertiary }}>№ {orderId}</span>
                                            </div>
                                            <span style={{ ...badge('accent'), whiteSpace: 'nowrap' }}>
                                                {statusLabel}
                                            </span>
                                        </div>
                                        {price && (
                                            <div
                                                style={{
                                                    ...text.body,
                                                    color: t.textPrimary,
                                                    fontWeight: 600,
                                                    marginBottom: 6,
                                                }}
                                            >
                                                {price}
                                            </div>
                                        )}
                                        {(hotelName || location) && (
                                            <div style={{ ...text.body, marginBottom: 4 }}>
                                                {[hotelName, location].filter(Boolean).join(', ')}
                                            </div>
                                        )}
                                        {period && <div style={text.caption}>{period}</div>}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}
        </PageShell>
    );
}

export default function LtOrdersPage() {
    return (
        <Suspense fallback={<PageShell><div style={{ ...text.body, padding: 24 }}>Загрузка...</div></PageShell>}>
            <LtOrdersContent />
        </Suspense>
    );
}
