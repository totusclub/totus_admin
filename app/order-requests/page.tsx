'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import PageShell from '@/components/PageShell';
import AdminNav from '@/components/AdminNav';
import Icon, { type IconName } from '@/components/Icon';
import { t, radius, text, cardStyle, button, badge } from '@/lib/theme';
import { getStaffAuth, staffLogout, type StaffAuth } from '@/lib/staff-auth-api';
import {
    listOrderRequests,
    updateOrderRequestStatus,
    type OrderRequest,
    type OrderRequestStatus,
} from '@/lib/order-requests-api';

const PAGE_LIMIT = 100;
const REFRESH_INTERVAL_MS = 60_000;

type BadgeTone = NonNullable<Parameters<typeof badge>[0]>;
type ButtonKind = NonNullable<Parameters<typeof button>[0]>;

const STATUS_META: Record<OrderRequestStatus, { label: string; tone: BadgeTone }> = {
    new: { label: 'Новое', tone: 'accent' },
    in_progress: { label: 'В работе', tone: 'info' },
    done: { label: 'Выполнено', tone: 'success' },
    rejected: { label: 'Отклонено', tone: 'error' },
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
const NEXT_ACTIONS: Record<OrderRequestStatus, { status: OrderRequestStatus; label: string; kind: ButtonKind; icon: IconName }[]> = {
    new: [
        { status: 'in_progress', label: 'В работу', kind: 'secondary', icon: 'refresh' },
        { status: 'done', label: 'Выполнено', kind: 'primary', icon: 'check' },
        { status: 'rejected', label: 'Отклонить', kind: 'danger', icon: 'close' },
    ],
    in_progress: [
        { status: 'done', label: 'Выполнено', kind: 'primary', icon: 'check' },
        { status: 'rejected', label: 'Отклонить', kind: 'danger', icon: 'close' },
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

// Отдельного входа у страницы больше нет: сессия сотрудника — общая для всей
// админки (AuthGuard + staffAuth). Если она истекла — уходим на /login.
export default function OrderRequestsPage() {
    const router = useRouter();
    const [authChecked, setAuthChecked] = useState(false);
    const [auth, setAuth] = useState<StaffAuth | null>(null);

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

    // Нет сессии (или она истекла) — на общий экран входа.
    useEffect(() => {
        if (authChecked && !auth) {
            staffLogout();
            router.replace('/login');
        }
    }, [authChecked, auth, router]);

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

    if (!authChecked || !auth) {
        return (
            <PageShell>
                <AdminNav />
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
                        <h1 style={{ ...text.pageTitle, margin: '0 0 6px' }}>
                            Обращения по заказам
                        </h1>
                        <div style={{ ...text.caption, fontWeight: 500 }}>
                            Всего: {total}
                        </div>
                    </div>
                    <button
                        onClick={() => load()}
                        disabled={loading}
                        style={{
                            ...button('secondary', 'md'),
                            borderRadius: radius.pill,
                            cursor: loading ? 'not-allowed' : 'pointer',
                        }}
                    >
                        <Icon name="refresh" size={16} />
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
                                    ...button('secondary', 'sm'),
                                    borderRadius: radius.pill,
                                    background: active ? t.accentSoft : t.surfaceInset,
                                    border: `1px solid ${active ? t.accentBorder : t.border}`,
                                    color: active ? t.accent : t.textTertiary,
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
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            marginBottom: 16,
                            padding: '10px 12px',
                            background: t.errorSoft,
                            border: `1px solid ${t.error}`,
                            borderRadius: radius.sm,
                            color: t.error,
                            fontSize: 13,
                            lineHeight: '18px',
                        }}
                    >
                        <Icon name="info" size={16} />
                        <span>{listError}</span>
                    </div>
                )}

                {requests.length === 0 ? (
                    <div style={{ padding: 24, textAlign: 'center', ...text.body, color: t.textTertiary }}>
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
                                        borderRadius: radius.md,
                                        border: `1px solid ${t.border}`,
                                        background: t.surfaceInset,
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: 10,
                                    }}
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                                        <span style={{ ...text.caption, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                                            <Icon name="calendar" size={14} />
                                            {formatDate(r.created_at)}
                                        </span>
                                        <span style={{ ...badge(isCancel ? 'error' : 'neutral'), fontSize: 11, padding: '3px 10px' }}>
                                            <Icon name={isCancel ? 'close' : 'mail'} size={12} />
                                            {isCancel ? 'Отмена' : 'Сообщение'}
                                        </span>
                                        <span style={{ ...badge(statusMeta.tone), fontSize: 11, padding: '3px 10px' }}>
                                            {statusMeta.label}
                                        </span>
                                        <Link
                                            href={`/orders/${r.order_id}`}
                                            style={{
                                                marginLeft: 'auto',
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                gap: 4,
                                                fontSize: 13,
                                                lineHeight: '18px',
                                                fontWeight: 600,
                                                color: t.accent,
                                                textDecoration: 'none',
                                                whiteSpace: 'nowrap',
                                            }}
                                        >
                                            Заказ #{r.order_id}
                                            <Icon name="chevronRight" size={14} />
                                        </Link>
                                    </div>

                                    <div style={{ ...text.body, color: t.textPrimary, fontWeight: 600 }}>
                                        {clientName(r)}
                                        <span style={{ color: t.textTertiary, fontWeight: 400 }}>
                                            {r.user_email ? ` · ${r.user_email}` : ''}
                                            {r.user_phone ? ` · ${r.user_phone}` : ''}
                                        </span>
                                    </div>

                                    {r.message ? (
                                        <div
                                            style={{
                                                padding: '10px 12px',
                                                borderRadius: radius.md,
                                                background: t.surface,
                                                border: `1px solid ${t.border}`,
                                                ...text.body,
                                                fontSize: 13,
                                                lineHeight: '20px',
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
                                                        ...button(a.kind, 'sm'),
                                                        cursor: busy ? 'not-allowed' : 'pointer',
                                                        opacity: busy ? 0.6 : 1,
                                                    }}
                                                >
                                                    <Icon name={a.icon} size={14} />
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
