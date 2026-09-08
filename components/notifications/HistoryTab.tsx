'use client';

// Вкладка «История»: поиск, фильтры, сводка из /stats, таблица из /history.

import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import Icon from '@/components/Icon';
import { t, radius, text, button } from '@/lib/theme';
import {
    getPushHistory,
    getPushStats,
    listReminderRules,
    type HistoryItem,
    type HistoryParams,
    type PushStats,
    type PushStatus,
} from '@/lib/push-api';
import {
    ErrorBox,
    PUSH_STATUS,
    StatusBadge,
    TYPE_OPTIONS,
    compactInput,
    describeSource,
    formatDateTime,
    selectStyle,
    typeMeta,
    userDisplay,
} from './shared';

const PAGE_LIMIT = 50;
const SEARCH_DEBOUNCE_MS = 500;

const STATUS_FILTERS: { value: PushStatus | ''; label: string }[] = [
    { value: '', label: 'Все статусы' },
    { value: 'sent', label: 'Отправлено' },
    { value: 'failed', label: 'Ошибка' },
    { value: 'deferred', label: 'Отложено' },
    { value: 'no_devices', label: 'Без устройств' },
    { value: 'none', label: 'В приложении' },
    { value: 'pending', label: 'В очереди' },
    { value: 'skipped', label: 'Пропущено' },
];

function StatCard({ label, value, hint }: { label: string; value: number | string; hint?: string }) {
    return (
        <div style={{ padding: '14px 16px', borderRadius: radius.md, border: `1px solid ${t.border}`, background: t.surfaceInset }}>
            <div style={text.caption}>{label}</div>
            <div style={{ fontSize: 24, lineHeight: '32px', fontWeight: 600, color: t.textPrimary }}>{value}</div>
            {hint ? <div style={{ ...text.caption, fontSize: 12 }}>{hint}</div> : null}
        </div>
    );
}

const th: CSSProperties = {
    textAlign: 'left',
    padding: '8px 10px',
    fontSize: 12,
    fontWeight: 600,
    color: t.textTertiary,
    borderBottom: `1px solid ${t.border}`,
    whiteSpace: 'nowrap',
};

const td: CSSProperties = {
    padding: '10px 10px',
    fontSize: 13,
    lineHeight: '18px',
    color: t.textSecondary,
    borderBottom: `1px solid ${t.border}`,
    verticalAlign: 'top',
};

export default function HistoryTab() {
    const [q, setQ] = useState('');
    const [debouncedQ, setDebouncedQ] = useState('');
    const [type, setType] = useState('');
    const [status, setStatus] = useState<PushStatus | ''>('');
    const [from, setFrom] = useState('');
    const [to, setTo] = useState('');

    const [stats, setStats] = useState<PushStats | null>(null);
    const [statsError, setStatsError] = useState<string | null>(null);

    const [items, setItems] = useState<HistoryItem[]>([]);
    const [hasMore, setHasMore] = useState(false);
    const [loading, setLoading] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [ruleNames, setRuleNames] = useState<Record<number, string>>({});
    const seq = useRef(0);

    // Имена правил для колонки «Источник».
    useEffect(() => {
        listReminderRules()
            .then((rules) => {
                const map: Record<number, string> = {};
                rules.forEach((r) => {
                    map[r.id] = r.name;
                });
                setRuleNames(map);
            })
            .catch(() => {
                /* источники покажем как «Напоминание №id» */
            });
    }, []);

    useEffect(() => {
        const timer = setTimeout(() => setDebouncedQ(q.trim()), SEARCH_DEBOUNCE_MS);
        return () => clearTimeout(timer);
    }, [q]);

    const params = useCallback((): HistoryParams => {
        const p: HistoryParams = { limit: PAGE_LIMIT };
        if (debouncedQ) p.q = debouncedQ;
        if (type) p.type = type;
        if (status) p.status = status;
        if (from) p.from = from;
        if (to) p.to = to;
        return p;
    }, [debouncedQ, type, status, from, to]);

    const load = useCallback(async () => {
        const my = ++seq.current;
        setLoading(true);
        try {
            const result = await getPushHistory(params());
            if (my !== seq.current) return;
            setItems(result.items || []);
            setHasMore(!!result.hasMore);
            setError(null);
        } catch (e: any) {
            if (my !== seq.current) return;
            setError(e?.message || 'Не удалось загрузить историю');
        } finally {
            if (my === seq.current) setLoading(false);
        }
    }, [params]);

    useEffect(() => {
        load();
    }, [load]);

    useEffect(() => {
        getPushStats({ from: from || undefined, to: to || undefined })
            .then((s) => {
                setStats(s);
                setStatsError(null);
            })
            .catch((e: any) => setStatsError(e?.message || 'Не удалось загрузить сводку'));
    }, [from, to]);

    const loadMore = async () => {
        const last = items[items.length - 1];
        if (!last) return;
        setLoadingMore(true);
        try {
            const result = await getPushHistory({ ...params(), before: last.id });
            setItems((list) => [...list, ...(result.items || [])]);
            setHasMore(!!result.hasMore);
        } catch (e: any) {
            setError(e?.message || 'Не удалось загрузить историю');
        } finally {
            setLoadingMore(false);
        }
    };

    const n = stats?.notifications;

    return (
        <div style={{ display: 'grid', gap: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10 }}>
                <StatCard label="Отправлено" value={n?.total ?? '—'} hint={n ? `в приложении ${n.inapp}` : from || to ? 'за период' : 'за 30 дней'} />
                <StatCard label="Доставлено (push)" value={n?.pushSent ?? '—'} hint={n ? `отложено ${n.pushDeferred} · без устройств ${n.noDevices}` : undefined} />
                <StatCard label="Открыто" value={n?.opened ?? '—'} hint={n ? `прочитано ${n.read}` : undefined} />
                <StatCard label="Ошибки токенов" value={n?.tokenErrors ?? '—'} hint={n ? `ошибок push ${n.pushFailed}` : undefined} />
            </div>
            {stats?.devices ? (
                <div style={text.caption}>
                    Устройств: {stats.devices.total} (активных {stats.devices.enabled}) · iOS {stats.devices.ios} · Android {stats.devices.android} · сайт {stats.devices.web} · desktop {stats.devices.desktop}
                </div>
            ) : null}
            <ErrorBox message={statsError} />

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                <div style={{ position: 'relative', flex: '1 1 240px', minWidth: 200 }}>
                    <Icon name="search" size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: t.textTertiary }} />
                    <input
                        style={{ ...compactInput, paddingLeft: 36 }}
                        placeholder="Пользователь, e-mail или текст"
                        value={q}
                        onChange={(e) => setQ(e.target.value)}
                    />
                </div>
                <select style={{ ...selectStyle, width: 'auto' }} value={type} onChange={(e) => setType(e.target.value)}>
                    <option value="">Все типы</option>
                    {TYPE_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>
                            {o.label}
                        </option>
                    ))}
                </select>
                <select style={{ ...selectStyle, width: 'auto' }} value={status} onChange={(e) => setStatus(e.target.value as PushStatus | '')}>
                    {STATUS_FILTERS.map((s) => (
                        <option key={s.value || 'all'} value={s.value}>
                            {s.label}
                        </option>
                    ))}
                </select>
                <input type="date" style={{ ...compactInput, width: 'auto' }} value={from} onChange={(e) => setFrom(e.target.value)} title="С даты" />
                <span style={text.caption}>—</span>
                <input type="date" style={{ ...compactInput, width: 'auto' }} value={to} onChange={(e) => setTo(e.target.value)} title="По дату" />
                <button type="button" onClick={load} disabled={loading} style={{ ...button('secondary', 'md'), borderRadius: radius.pill }}>
                    <Icon name="refresh" size={16} />
                    {loading ? 'Обновление...' : 'Обновить'}
                </button>
            </div>

            <ErrorBox message={error} />

            <div style={{ overflowX: 'auto', borderRadius: radius.md, border: `1px solid ${t.border}` }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 900 }}>
                    <thead>
                        <tr style={{ background: t.surfaceInset }}>
                            <th style={th}>Время</th>
                            <th style={th}>Пользователь</th>
                            <th style={th}>Тип</th>
                            <th style={{ ...th, width: '34%' }}>Заголовок и текст</th>
                            <th style={th}>Статус</th>
                            <th style={th}>Источник</th>
                        </tr>
                    </thead>
                    <tbody>
                        {items.length === 0 ? (
                            <tr>
                                <td colSpan={6} style={{ ...td, textAlign: 'center', padding: 24, color: t.textTertiary, borderBottom: 'none' }}>
                                    {loading ? 'Загрузка...' : 'Уведомлений не найдено'}
                                </td>
                            </tr>
                        ) : (
                            items.map((item) => {
                                const meta = typeMeta(item.type);
                                const st = PUSH_STATUS[item.pushStatus] || { label: item.pushStatus || '—', tone: 'neutral' as const };
                                const user = userDisplay(item.user, item.userId);
                                return (
                                    <tr key={item.id}>
                                        <td style={{ ...td, whiteSpace: 'nowrap' }}>{formatDateTime(item.createdAt)}</td>
                                        <td style={td}>
                                            <div style={{ color: t.textPrimary, fontWeight: 600 }}>{user.name}</div>
                                            {user.email ? <div style={{ ...text.caption, fontSize: 12 }}>{user.email}</div> : null}
                                        </td>
                                        <td style={{ ...td, whiteSpace: 'nowrap' }}>
                                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                                                <span
                                                    aria-hidden
                                                    style={{
                                                        width: 28,
                                                        height: 28,
                                                        borderRadius: radius.pill,
                                                        background: `${meta.color}1F`,
                                                        color: meta.color,
                                                        display: 'inline-flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        flexShrink: 0,
                                                    }}
                                                >
                                                    <Icon name={meta.icon} size={15} />
                                                </span>
                                                {meta.label}
                                            </span>
                                        </td>
                                        <td style={td}>
                                            <div style={{ color: t.textPrimary, fontWeight: 600 }}>{item.title}</div>
                                            <div style={{ wordBreak: 'break-word' }}>{item.body}</div>
                                        </td>
                                        <td style={td}>
                                            <StatusBadge label={st.label} tone={st.tone} />
                                            {item.openedAt ? <div style={{ ...text.caption, fontSize: 12, marginTop: 4 }}>открыто {formatDateTime(item.openedAt)}</div> : null}
                                        </td>
                                        <td style={{ ...td, whiteSpace: 'nowrap' }}>{describeSource(item.source, ruleNames)}</td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>

            {hasMore ? (
                <div style={{ textAlign: 'center' }}>
                    <button type="button" onClick={loadMore} disabled={loadingMore} style={{ ...button('secondary', 'md'), opacity: loadingMore ? 0.6 : 1 }}>
                        {loadingMore ? 'Загрузка...' : 'Показать ещё'}
                    </button>
                </div>
            ) : null}
        </div>
    );
}
