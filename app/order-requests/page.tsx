'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import PageShell from '@/components/PageShell';
import AdminNav from '@/components/AdminNav';
import {
    getStaffAuth,
    staffSignIn,
    staffLogout,
    type StaffAuth,
} from '@/lib/staff-auth-api';
import {
    listOrderRequests,
    updateOrderRequestStatus,
    type OrderRequest,
    type OrderRequestStatus,
} from '@/lib/order-requests-api';

const PAGE_LIMIT = 100;
const REFRESH_INTERVAL_MS = 60_000;

const cardStyle: React.CSSProperties = {
    padding: 24,
    borderRadius: 24,
    background: 'linear-gradient(135deg, rgba(15,23,42,0.98), rgba(2,6,23,0.97))',
    border: '1px solid rgba(55,65,81,0.6)',
    boxShadow: '0 24px 60px rgba(0,0,0,0.4), 0 0 0 1px rgba(15,23,42,0.8)',
    backdropFilter: 'blur(20px)',
};

const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '10px 12px',
    borderRadius: 10,
    border: '1px solid rgba(75,85,99,0.9)',
    backgroundColor: 'rgba(15,23,42,0.95)',
    color: '#e5e7eb',
    fontSize: 14,
    outline: 'none',
};

const STATUS_META: Record<OrderRequestStatus, { label: string; color: string; bg: string; border: string }> = {
    new: { label: 'Новое', color: '#FE732E', bg: 'rgba(254,115,46,0.14)', border: 'rgba(254,115,46,0.5)' },
    in_progress: { label: 'В работе', color: '#7dd3fc', bg: 'rgba(56,189,248,0.14)', border: 'rgba(56,189,248,0.5)' },
    done: { label: 'Выполнено', color: '#bbf7d0', bg: 'rgba(34,197,94,0.14)', border: 'rgba(34,197,94,0.5)' },
    rejected: { label: 'Отклонено', color: '#fecaca', bg: 'rgba(239,68,68,0.14)', border: 'rgba(239,68,68,0.5)' },
};

const FILTERS: { value: OrderRequestStatus | ''; label: string }[] = [
    { value: '', label: 'Все' },
    { value: 'new', label: 'Новые' },
    { value: 'in_progress', label: 'В работе' },
    { value: 'done', label: 'Выполнено' },
    { value: 'rejected', label: 'Отклонено' },
];

// Разумные переходы статусов: из «Новое» — в работу/выполнено/отклонено,
// из «В работе» — только выполнено/отклонено, финальные статусы не меняем.
const NEXT_ACTIONS: Record<OrderRequestStatus, { status: OrderRequestStatus; label: string; color: string; border: string; bg: string }[]> = {
    new: [
        { status: 'in_progress', label: 'В работу', color: '#7dd3fc', border: 'rgba(56,189,248,0.5)', bg: 'rgba(56,189,248,0.12)' },
        { status: 'done', label: 'Выполнено', color: '#bbf7d0', border: 'rgba(34,197,94,0.5)', bg: 'rgba(34,197,94,0.12)' },
        { status: 'rejected', label: 'Отклонить', color: '#fecaca', border: 'rgba(239,68,68,0.5)', bg: 'rgba(239,68,68,0.12)' },
    ],
    in_progress: [
        { status: 'done', label: 'Выполнено', color: '#bbf7d0', border: 'rgba(34,197,94,0.5)', bg: 'rgba(34,197,94,0.12)' },
        { status: 'rejected', label: 'Отклонить', color: '#fecaca', border: 'rgba(239,68,68,0.5)', bg: 'rgba(239,68,68,0.12)' },
    ],
    done: [],
    rejected: [],
};

function formatDate(value: string): string {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return value;
    return d.toLocaleString('ru-RU', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}

function clientName(r: OrderRequest): string {
    const name = [r.user_name, r.user_l_name].filter(Boolean).join(' ').trim();
    return name || `Пользователь #${r.user_id}`;
}

export default function OrderRequestsPage() {
    const [authChecked, setAuthChecked] = useState(false);
    const [auth, setAuth] = useState<StaffAuth | null>(null);

    // login form
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loginLoading, setLoginLoading] = useState(false);
    const [loginError, setLoginError] = useState<string | null>(null);

    // list
    const [requests, setRequests] = useState<OrderRequest[]>([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(false);
    const [listError, setListError] = useState<string | null>(null);
    const [filter, setFilter] = useState<OrderRequestStatus | ''>('');
    const [updatingId, setUpdatingId] = useState<number | null>(null);

    // localStorage доступен только в браузере — читаем сессию после маунта.
    useEffect(() => {
        setAuth(getStaffAuth());
        setAuthChecked(true);
    }, []);

    const load = useCallback(
        async (silent = false) => {
            if (!silent) setLoading(true);
            try {
                const result = await listOrderRequests({ status: filter, limit: PAGE_LIMIT, offset: 0 });
                setRequests(result.data || []);
                setTotal(result.total ?? (result.data ? result.data.length : 0));
                setListError(null);
            } catch (e: any) {
                if (e?.message === 'staff_session_expired') {
                    // refresh-токен тоже истёк или отозван — просим войти заново
                    setAuth(null);
                    setRequests([]);
                    return;
                }
                console.error('Failed to load order requests:', e);
                if (!silent) setListError(e?.message || 'Не удалось загрузить обращения');
            } finally {
                if (!silent) setLoading(false);
            }
        },
        [filter],
    );

    // Первичная загрузка + перезагрузка при смене фильтра.
    useEffect(() => {
        if (!auth) return;
        load();
    }, [auth, load]);

    // Автообновление списка раз в 60 секунд (тихо, без спиннера).
    useEffect(() => {
        if (!auth) return;
        const timer = setInterval(() => {
            load(true);
        }, REFRESH_INTERVAL_MS);
        return () => clearInterval(timer);
    }, [auth, load]);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoginError(null);
        setLoginLoading(true);
        try {
            const nextAuth = await staffSignIn(email.trim(), password);
            setAuth(nextAuth);
            setPassword('');
        } catch (err: any) {
            setLoginError(err?.message || 'Не удалось войти');
        } finally {
            setLoginLoading(false);
        }
    };

    const handleLogout = () => {
        staffLogout();
        setAuth(null);
        setRequests([]);
        setTotal(0);
    };

    const handleStatusChange = async (id: number, status: OrderRequestStatus) => {
        setUpdatingId(id);
        try {
            await updateOrderRequestStatus(id, status);
            await load(true);
        } catch (e: any) {
            if (e?.message === 'staff_session_expired') {
                setAuth(null);
                return;
            }
            alert(e?.message || 'Не удалось обновить статус');
        } finally {
            setUpdatingId(null);
        }
    };

    if (!authChecked) {
        return (
            <PageShell>
                <AdminNav />
            </PageShell>
        );
    }

    if (!auth) {
        return (
            <PageShell>
                <AdminNav />
                <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 40 }}>
                    <div
                        style={{
                            width: '100%',
                            maxWidth: 380,
                            borderRadius: 24,
                            padding: '28px 24px 22px',
                            background: 'linear-gradient(145deg, rgba(15,23,42,0.96), rgba(17,24,39,0.98))',
                            border: '1px solid rgba(55,65,81,0.85)',
                            boxShadow: '0 25px 70px rgba(15,23,42,0.95), 0 0 0 1px rgba(2,6,23,0.9)',
                        }}
                    >
                        <div style={{ textAlign: 'center', marginBottom: 20 }}>
                            <h1 style={{ margin: 0, marginBottom: 6, color: '#f9fafb', fontSize: 20, fontWeight: 700 }}>
                                Вход для сотрудников
                            </h1>
                            <p style={{ margin: 0, color: '#9ca3af', fontSize: 12, lineHeight: 1.5 }}>
                                Staff-доступ kedam (обращения по заказам).
                                <br />
                                Это не логин агента звонков.
                            </p>
                        </div>

                        {loginError && (
                            <div
                                style={{
                                    marginBottom: 16,
                                    padding: '10px 12px',
                                    backgroundColor: 'rgba(127,29,29,0.18)',
                                    border: '1px solid rgba(248,113,113,0.55)',
                                    borderRadius: 10,
                                    color: '#fecaca',
                                    fontSize: 13,
                                }}
                            >
                                {loginError}
                            </div>
                        )}

                        <form onSubmit={handleLogin}>
                            <div style={{ marginBottom: 14 }}>
                                <label style={{ display: 'block', marginBottom: 6, color: '#e5e7eb', fontSize: 13, fontWeight: 500 }}>
                                    Email
                                </label>
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required
                                    disabled={loginLoading}
                                    placeholder="staff@totus.club"
                                    style={inputStyle}
                                />
                            </div>
                            <div style={{ marginBottom: 18 }}>
                                <label style={{ display: 'block', marginBottom: 6, color: '#e5e7eb', fontSize: 13, fontWeight: 500 }}>
                                    Пароль
                                </label>
                                <input
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                    disabled={loginLoading}
                                    placeholder="Пароль сотрудника"
                                    style={inputStyle}
                                />
                            </div>
                            <button
                                type="submit"
                                disabled={loginLoading}
                                style={{
                                    width: '100%',
                                    padding: '11px 14px',
                                    borderRadius: 999,
                                    border: 'none',
                                    background: loginLoading ? '#374151' : 'linear-gradient(135deg, #FE732E, #f97316)',
                                    color: '#f9fafb',
                                    fontSize: 14,
                                    fontWeight: 600,
                                    cursor: loginLoading ? 'not-allowed' : 'pointer',
                                    boxShadow: loginLoading ? 'none' : '0 16px 40px rgba(248,113,22,0.55)',
                                }}
                            >
                                {loginLoading ? 'Вход...' : 'Войти'}
                            </button>
                        </form>
                    </div>
                </div>
            </PageShell>
        );
    }

    return (
        <PageShell>
            <AdminNav />

            <div style={cardStyle}>
                <div
                    style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start',
                        gap: 12,
                        flexWrap: 'wrap',
                        marginBottom: 18,
                    }}
                >
                    <div>
                        <h1 style={{ margin: 0, color: '#f9fafb', fontSize: 24, fontWeight: 700, marginBottom: 6 }}>
                            Обращения по заказам
                        </h1>
                        <div style={{ fontSize: 13, color: '#9ca3af', fontWeight: 500 }}>
                            Всего: {total}
                            {auth.profile?.email ? (
                                <>
                                    {' '}· Сотрудник: {[auth.profile.name, auth.profile.lastname].filter(Boolean).join(' ') || auth.profile.email}
                                    {' '}·{' '}
                                    <button
                                        onClick={handleLogout}
                                        style={{
                                            background: 'none',
                                            border: 'none',
                                            padding: 0,
                                            color: '#9ca3af',
                                            fontSize: 13,
                                            fontWeight: 500,
                                            cursor: 'pointer',
                                            textDecoration: 'underline',
                                        }}
                                    >
                                        Выйти
                                    </button>
                                </>
                            ) : null}
                        </div>
                    </div>
                    <button
                        onClick={() => load()}
                        disabled={loading}
                        style={{
                            padding: '10px 18px',
                            borderRadius: 999,
                            border: '1px solid rgba(55,65,81,0.8)',
                            backgroundColor: 'rgba(15,23,42,0.95)',
                            color: '#e5e7eb',
                            cursor: loading ? 'not-allowed' : 'pointer',
                            fontSize: 13,
                            fontWeight: 600,
                        }}
                    >
                        {loading ? 'Обновление...' : 'Обновить'}
                    </button>
                </div>

                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
                    {FILTERS.map((f) => {
                        const active = filter === f.value;
                        return (
                            <button
                                key={f.value || 'all'}
                                onClick={() => setFilter(f.value)}
                                style={{
                                    padding: '8px 16px',
                                    borderRadius: 999,
                                    border: active ? '1px solid rgba(254,115,46,0.7)' : '1px solid rgba(55,65,81,0.7)',
                                    background: active ? 'rgba(254,115,46,0.16)' : 'rgba(15,23,42,0.9)',
                                    color: active ? '#FE732E' : '#9ca3af',
                                    cursor: 'pointer',
                                    fontSize: 13,
                                    fontWeight: 600,
                                    whiteSpace: 'nowrap',
                                }}
                            >
                                {f.label}
                            </button>
                        );
                    })}
                </div>

                {listError && (
                    <div
                        style={{
                            marginBottom: 16,
                            padding: '10px 12px',
                            backgroundColor: 'rgba(127,29,29,0.18)',
                            border: '1px solid rgba(248,113,113,0.55)',
                            borderRadius: 10,
                            color: '#fecaca',
                            fontSize: 13,
                        }}
                    >
                        {listError}
                    </div>
                )}

                {requests.length === 0 ? (
                    <div style={{ padding: 24, textAlign: 'center', color: '#6b7280', fontSize: 14 }}>
                        {loading ? 'Загрузка...' : 'Обращений нет'}
                    </div>
                ) : (
                    <div style={{ display: 'grid', gap: 10 }}>
                        {requests.map((r) => {
                            const statusMeta = STATUS_META[r.status] || STATUS_META.new;
                            const actions = NEXT_ACTIONS[r.status] || [];
                            const isCancel = r.type === 'cancel';
                            const busy = updatingId === r.id;
                            return (
                                <div
                                    key={r.id}
                                    style={{
                                        padding: '16px 18px',
                                        borderRadius: 18,
                                        border: '1px solid rgba(55,65,81,0.6)',
                                        background: 'linear-gradient(135deg, rgba(15,23,42,0.98), rgba(2,6,23,0.97))',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: 10,
                                    }}
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                                        <span style={{ fontSize: 12, color: '#9ca3af', fontWeight: 500 }}>
                                            {formatDate(r.created_at)}
                                        </span>
                                        <span
                                            style={{
                                                padding: '3px 10px',
                                                borderRadius: 999,
                                                fontSize: 11,
                                                fontWeight: 700,
                                                color: isCancel ? '#fecaca' : '#e5e7eb',
                                                backgroundColor: isCancel ? 'rgba(239,68,68,0.16)' : 'rgba(55,65,81,0.7)',
                                                border: `1px solid ${isCancel ? 'rgba(239,68,68,0.55)' : 'rgba(75,85,99,0.9)'}`,
                                            }}
                                        >
                                            {isCancel ? 'Отмена' : 'Сообщение'}
                                        </span>
                                        <span
                                            style={{
                                                padding: '3px 10px',
                                                borderRadius: 999,
                                                fontSize: 11,
                                                fontWeight: 700,
                                                color: statusMeta.color,
                                                backgroundColor: statusMeta.bg,
                                                border: `1px solid ${statusMeta.border}`,
                                            }}
                                        >
                                            {statusMeta.label}
                                        </span>
                                        <Link
                                            href={`/orders/${r.order_id}`}
                                            style={{
                                                marginLeft: 'auto',
                                                fontSize: 13,
                                                fontWeight: 700,
                                                color: '#FE732E',
                                                textDecoration: 'none',
                                                whiteSpace: 'nowrap',
                                            }}
                                        >
                                            Заказ #{r.order_id} →
                                        </Link>
                                    </div>

                                    <div style={{ fontSize: 13, color: '#e5e7eb', fontWeight: 600 }}>
                                        {clientName(r)}
                                        <span style={{ color: '#9ca3af', fontWeight: 500 }}>
                                            {r.user_email ? ` · ${r.user_email}` : ''}
                                            {r.user_phone ? ` · ${r.user_phone}` : ''}
                                        </span>
                                    </div>

                                    {r.message ? (
                                        <div
                                            style={{
                                                padding: '10px 12px',
                                                borderRadius: 12,
                                                background: 'rgba(2,6,23,0.6)',
                                                border: '1px solid rgba(55,65,81,0.5)',
                                                color: '#d1d5db',
                                                fontSize: 13,
                                                lineHeight: 1.5,
                                                whiteSpace: 'pre-wrap',
                                                wordBreak: 'break-word',
                                            }}
                                        >
                                            {r.message}
                                        </div>
                                    ) : null}

                                    {actions.length > 0 && (
                                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                            {actions.map((a) => (
                                                <button
                                                    key={a.status}
                                                    onClick={() => handleStatusChange(r.id, a.status)}
                                                    disabled={busy}
                                                    style={{
                                                        padding: '8px 16px',
                                                        borderRadius: 999,
                                                        border: `1px solid ${a.border}`,
                                                        background: a.bg,
                                                        color: a.color,
                                                        cursor: busy ? 'not-allowed' : 'pointer',
                                                        fontSize: 12,
                                                        fontWeight: 700,
                                                        opacity: busy ? 0.6 : 1,
                                                        whiteSpace: 'nowrap',
                                                    }}
                                                >
                                                    {a.label}
                                                </button>
                                            ))}
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
