'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import PageShell from '@/components/PageShell';
import AdminNav from '@/components/AdminNav';
import Icon from '@/components/Icon';
import { t, radius, text, cardStyle, inputStyle, button, badge } from '@/lib/theme';
import {
    getAllOrders,
    getUserOrders,
    getPackageData,
    getOrderId,
    getOrderPrice,
    getStatusLabel,
    formatOrderDate,
    formatPeriod,
    collectTourists,
    isOrderAwaitingPayment,
    type OrderWithUser,
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

function OrdersContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const userIdParam = searchParams.get('userId');

    const [orders, setOrders] = useState<OrderWithUser[]>([]);
    const [loading, setLoading] = useState(false);
    const [filterUser, setFilterUser] = useState<User | null>(null);
    const [search, setSearch] = useState('');

    const load = async () => {
        try {
            setLoading(true);
            if (userIdParam) {
                const uid = Number(userIdParam);
                const [list, user] = await Promise.all([
                    getUserOrders(uid),
                    getUserById(uid).catch(() => null),
                ]);
                setFilterUser(user);
                setOrders(list.map((o): OrderWithUser => ({ ...o, _user: user })));
            } else {
                setFilterUser(null);
                const all = await getAllOrders();
                setOrders(all);
            }
        } catch (e) {
            console.error('Failed to load orders:', e);
            alert('Не удалось загрузить заказы');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [userIdParam]);

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return orders;
        return orders.filter((o) => {
            const pkg = getPackageData(o);
            const haystack = [
                getOrderId(o),
                getStatusLabel(o),
                pkg?.hotel?.name,
                pkg?.hotel?.city,
                pkg?.hotel?.country,
                o._user ? getUserDisplayName(o._user) : '',
                o._user?.email,
                o._user?.loyaltyId,
            ]
                .filter(Boolean)
                .join(' ')
                .toLowerCase();
            return haystack.includes(q);
        });
    }, [orders, search]);

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
                        marginBottom: 20,
                    }}
                >
                    <div>
                        <h1 style={{ ...text.pageTitle, margin: '0 0 6px' }}>
                            {filterUser ? `Заказы — ${getUserDisplayName(filterUser)}` : 'Все заказы'}
                        </h1>
                        <div style={text.caption}>
                            Всего заказов: {orders.length}
                            {filterUser && (
                                <>
                                    {' '}· ID: <strong style={{ color: t.accent }}>{filterUser.loyaltyId}</strong>
                                </>
                            )}
                        </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                        {userIdParam && (
                            <button onClick={() => router.push('/orders')} style={button('secondary', 'md')}>
                                <Icon name="arrowLeft" size={16} />
                                Все заказы
                            </button>
                        )}
                        <button
                            onClick={load}
                            disabled={loading}
                            style={{
                                ...button('secondary', 'md'),
                                cursor: loading ? 'not-allowed' : 'pointer',
                                opacity: loading ? 0.6 : 1,
                            }}
                        >
                            <Icon name="refresh" size={16} />
                            {loading ? 'Обновление...' : 'Обновить'}
                        </button>
                    </div>
                </div>

                <div
                    style={{
                        ...inputStyle,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        marginBottom: 20,
                        color: t.textTertiary,
                    }}
                >
                    <Icon name="search" size={18} />
                    <input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Поиск по № заказа, отелю, клиенту..."
                        style={{
                            flex: 1,
                            minWidth: 0,
                            border: 'none',
                            outline: 'none',
                            background: 'transparent',
                            color: t.textPrimary,
                            fontSize: 14,
                            fontFamily: 'inherit',
                        }}
                    />
                </div>

                {loading && orders.length === 0 ? (
                    <div style={{ ...text.body, color: t.textTertiary, padding: 24, textAlign: 'center' }}>
                        Загрузка заказов...
                    </div>
                ) : filtered.length === 0 ? (
                    <div style={{ ...text.body, color: t.textTertiary, padding: 24, textAlign: 'center' }}>
                        Заказы не найдены
                    </div>
                ) : (
                    <div style={{ display: 'grid', gap: 12 }}>
                        {filtered.map((order) => {
                            const pkg = getPackageData(order);
                            const orderId = getOrderId(order);
                            const statusLabel = getStatusLabel(order);
                            const awaiting = isOrderAwaitingPayment(order);
                            const tone = statusTone(
                                [pkg?.state, (order as any)?.state, statusLabel].filter(Boolean).join(' '),
                                awaiting
                            );
                            const hotelName = pkg?.hotel?.name || '';
                            const location = pkg?.hotel
                                ? [pkg.hotel.city, pkg.hotel.country].filter(Boolean).join(', ')
                                : '';
                            const period = formatPeriod(pkg);
                            const tourists = collectTourists(order, pkg);

                            return (
                                <div
                                    key={`${orderId}-${order.id}`}
                                    onClick={() => router.push(`/orders/${orderId}`)}
                                    style={{
                                        padding: '18px 20px',
                                        borderRadius: radius.lg,
                                        border: `1px solid ${t.border}`,
                                        background: t.surface,
                                        cursor: 'pointer',
                                        transition: 'background 0.15s, border-color 0.15s',
                                    }}
                                    onMouseEnter={(e) => {
                                        e.currentTarget.style.background = t.surfaceHover;
                                        e.currentTarget.style.borderColor = t.borderStrong;
                                    }}
                                    onMouseLeave={(e) => {
                                        e.currentTarget.style.background = t.surface;
                                        e.currentTarget.style.borderColor = t.border;
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
                                        <div style={text.cardTitle}>
                                            Тур <span style={{ color: t.textTertiary }}>№ {orderId}</span>
                                        </div>
                                        <span style={{ ...badge(tone), whiteSpace: 'nowrap' }}>{statusLabel}</span>
                                    </div>

                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 8 }}>
                                        <span style={{ ...text.cardTitle, fontWeight: 700 }}>
                                            {getOrderPrice(order)}
                                        </span>
                                        {awaiting && <span style={badge('warning')}>Ожидает оплаты</span>}
                                        <span style={text.caption}>
                                            От {formatOrderDate((order as any)?.c_date || pkg?.created_at)}
                                        </span>
                                    </div>

                                    {(hotelName || location) && (
                                        <div style={{ ...text.body, marginBottom: 4 }}>
                                            {[hotelName, location].filter(Boolean).join(', ')}
                                        </div>
                                    )}
                                    {period && <div style={{ ...text.caption, marginBottom: 4 }}>{period}</div>}
                                    {tourists && <div style={text.caption}>Туристы: {tourists}</div>}

                                    {order._user && (
                                        <div
                                            style={{
                                                ...text.caption,
                                                marginTop: 10,
                                                paddingTop: 10,
                                                borderTop: `1px solid ${t.border}`,
                                                display: 'flex',
                                                gap: 8,
                                                flexWrap: 'wrap',
                                            }}
                                        >
                                            <span>Клиент: <strong style={{ color: t.textSecondary }}>{getUserDisplayName(order._user)}</strong></span>
                                            <span style={{ color: t.textDisabled }}>•</span>
                                            <span>ID: <strong style={{ color: t.accent }}>{order._user.loyaltyId}</strong></span>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </PageShell>
    );
}

export default function OrdersPage() {
    return (
        <Suspense fallback={<PageShell><div style={{ ...text.body, color: t.textTertiary, padding: 24 }}>Загрузка...</div></PageShell>}>
            <OrdersContent />
        </Suspense>
    );
}
