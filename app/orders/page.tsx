'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import PageShell from '@/components/PageShell';
import AdminNav from '@/components/AdminNav';
import Icon from '@/components/Icon';
import { PageHeader, Toolbar, SearchInput, RefreshButton, pageCard, listStyle, listItemStyle, emptyTextStyle } from '@/components/PageKit';
import { t, text, button, badge } from '@/lib/theme';
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

            <div style={pageCard}>
                <PageHeader
                    title={filterUser ? `Заказы — ${getUserDisplayName(filterUser)}` : 'Все заказы'}
                    subtitle={
                        <>
                            Всего заказов: {orders.length}
                            {filterUser && (
                                <>
                                    {' '}· ID: <strong style={{ color: t.accent }}>{filterUser.loyaltyId}</strong>
                                </>
                            )}
                        </>
                    }
                    actions={
                        <>
                            {userIdParam && (
                                <button onClick={() => router.push('/orders')} style={button('secondary', 'md')}>
                                    <Icon name="arrowLeft" size={16} />
                                    Все заказы
                                </button>
                            )}
                            <RefreshButton onClick={load} loading={loading} />
                        </>
                    }
                />

                <Toolbar>
                    <SearchInput value={search} onChange={setSearch} placeholder="Поиск по № заказа, отелю, клиенту..." />
                </Toolbar>

                {loading && orders.length === 0 ? (
                    <div style={emptyTextStyle}>Загрузка заказов...</div>
                ) : filtered.length === 0 ? (
                    <div style={emptyTextStyle}>Заказы не найдены</div>
                ) : (
                    <div style={listStyle}>
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
                                        ...listItemStyle,
                                        cursor: 'pointer',
                                        transition: 'background 0.15s, border-color 0.15s',
                                    }}
                                    onMouseEnter={(e) => {
                                        e.currentTarget.style.background = t.surfaceHover;
                                        e.currentTarget.style.borderColor = t.borderStrong;
                                    }}
                                    onMouseLeave={(e) => {
                                        e.currentTarget.style.background = t.surfaceInset;
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
        <Suspense fallback={<PageShell><AdminNav /><div style={{ ...text.body, color: t.textTertiary, padding: 24 }}>Загрузка...</div></PageShell>}>
            <OrdersContent />
        </Suspense>
    );
}
