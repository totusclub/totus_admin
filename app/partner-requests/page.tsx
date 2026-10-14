'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import PageShell from '@/components/PageShell';
import AdminNav from '@/components/AdminNav';
import Icon, { type IconName } from '@/components/Icon';
import { t, radius, text, cardStyle, button, badge, inputStyle, textareaStyle } from '@/lib/theme';
import { getStaffAuth, staffLogout, type StaffAuth } from '@/lib/staff-auth-api';
import {
    listPartnerRequests,
    updatePartnerRequest,
    deletePartnerRequest,
    type PartnerRequest,
    type PartnerRequestKind,
    type PartnerRequestStatus,
} from '@/lib/partner-requests-api';

// Заявки «Стать партнёром» со страницы totus.club/partners.
const PAGE_LIMIT = 50;
const REFRESH_INTERVAL_MS = 60_000;

type BadgeTone = NonNullable<Parameters<typeof badge>[0]>;
type ButtonKind = NonNullable<Parameters<typeof button>[0]>;

const STATUS_META: Record<PartnerRequestStatus, { label: string; tone: BadgeTone }> = {
    new: { label: 'Новая', tone: 'accent' },
    in_progress: { label: 'В работе', tone: 'info' },
    done: { label: 'Договорились', tone: 'success' },
    rejected: { label: 'Отклонена', tone: 'error' },
};

const KIND_LABEL: Record<PartnerRequestKind, string> = {
    operator: 'Туроператор',
    hotel: 'Отель',
    ads: 'Реклама',
    other: 'Другое',
};

const FILTERS: { value: PartnerRequestStatus | ''; label: string }[] = [
    { value: '', label: 'Все' },
    { value: 'new', label: 'Новые' },
    { value: 'in_progress', label: 'В работе' },
    { value: 'done', label: 'Договорились' },
    { value: 'rejected', label: 'Отклонены' },
];

const ACTIONS: { status: PartnerRequestStatus; label: string; kind: ButtonKind; icon: IconName }[] = [
    { status: 'in_progress', label: 'В работу', kind: 'secondary', icon: 'refresh' },
    { status: 'done', label: 'Договорились', kind: 'primary', icon: 'check' },
    { status: 'rejected', label: 'Отклонить', kind: 'danger', icon: 'close' },
    { status: 'new', label: 'Вернуть в новые', kind: 'tertiary', icon: 'arrowLeft' },
];

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

const linkStyle = { color: t.accent, textDecoration: 'none', fontWeight: 600 } as const;

function RequestCard({
    r,
    busy,
    onStatus,
    onSaveNote,
    onDelete,
}: {
    r: PartnerRequest;
    busy: boolean;
    onStatus: (status: PartnerRequestStatus) => void;
    onSaveNote: (note: string) => void;
    onDelete: () => void;
}) {
    const [note, setNote] = useState(r.note || '');
    useEffect(() => setNote(r.note || ''), [r.note]);
    const statusMeta = STATUS_META[r.status] || STATUS_META.new;
    const noteChanged = note.trim() !== (r.note || '').trim();

    return (
        <div
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
                <span style={{ ...badge('neutral'), fontSize: 11, padding: '3px 10px' }}>
                    {KIND_LABEL[r.kind] || r.kind}
                </span>
                <span style={{ ...badge(statusMeta.tone), fontSize: 11, padding: '3px 10px' }}>{statusMeta.label}</span>
                <span style={{ ...text.caption, marginLeft: 'auto' }}>№ {r.id}</span>
            </div>

            <div style={{ ...text.body, color: t.textPrimary, fontWeight: 600, fontSize: 15 }}>{r.company}</div>
            <div style={{ ...text.body, color: t.textSecondary, display: 'flex', gap: 14, flexWrap: 'wrap' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <Icon name="user" size={14} />
                    {r.name}
                </span>
                <a href={`mailto:${r.email}`} style={{ ...linkStyle, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <Icon name="mail" size={14} />
                    {r.email}
                </a>
                {r.phone ? (
                    <a href={`tel:${r.phone}`} style={{ ...linkStyle, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                        <Icon name="phone" size={14} />
                        {r.phone}
                    </a>
                ) : null}
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
            ) : (
                <div style={{ ...text.caption }}>Без сообщения</div>
            )}

            <div style={{ display: 'grid', gap: 6 }}>
                <label style={{ ...text.caption, fontWeight: 600 }} htmlFor={`note-${r.id}`}>
                    Заметка сотрудника
                </label>
                <textarea
                    id={`note-${r.id}`}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    rows={2}
                    maxLength={2000}
                    placeholder="Например: созвонились, ждём договор"
                    style={{ ...textareaStyle, minHeight: 56 }}
                />
                {noteChanged && (
                    <div>
                        <button
                            onClick={() => onSaveNote(note)}
                            disabled={busy}
                            style={{ ...button('secondary', 'sm'), opacity: busy ? 0.6 : 1 }}
                        >
                            <Icon name="check" size={14} />
                            Сохранить заметку
                        </button>
                    </div>
                )}
            </div>

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                {ACTIONS.filter((a) => a.status !== r.status).map((a) => (
                    <button
                        key={a.status}
                        onClick={() => onStatus(a.status)}
                        disabled={busy}
                        style={{ ...button(a.kind, 'sm'), cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? 0.6 : 1 }}
                    >
                        <Icon name={a.icon} size={14} />
                        {a.label}
                    </button>
                ))}
                <button
                    onClick={onDelete}
                    disabled={busy}
                    title="Удалить заявку"
                    style={{ ...button('tertiary', 'sm'), marginLeft: 'auto', opacity: busy ? 0.6 : 1 }}
                >
                    <Icon name="delete" size={14} />
                    Удалить
                </button>
            </div>
        </div>
    );
}

export default function PartnerRequestsPage() {
    const router = useRouter();
    const [authChecked, setAuthChecked] = useState(false);
    const [auth, setAuth] = useState<StaffAuth | null>(null);

    const [requests, setRequests] = useState<PartnerRequest[]>([]);
    const [total, setTotal] = useState(0);
    const [counts, setCounts] = useState<Record<PartnerRequestStatus, number> | null>(null);
    const [loading, setLoading] = useState(false);
    const [listError, setListError] = useState<string | null>(null);
    const [filter, setFilter] = useState<PartnerRequestStatus | ''>('');
    const [query, setQuery] = useState('');
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(0);
    const [busyId, setBusyId] = useState<number | null>(null);

    useEffect(() => {
        setAuth(getStaffAuth());
        setAuthChecked(true);
    }, []);

    useEffect(() => {
        if (authChecked && !auth) {
            staffLogout();
            router.replace('/login');
        }
    }, [authChecked, auth, router]);

    // Поиск — через 400 мс после ввода.
    useEffect(() => {
        const timer = setTimeout(() => setSearch(query.trim()), 400);
        return () => clearTimeout(timer);
    }, [query]);

    useEffect(() => setPage(0), [filter, search]);

    const handleError = (e: any, fallback: string, silent = false) => {
        if (e?.message === 'staff_session_expired') {
            setAuth(null);
            setRequests([]);
            return;
        }
        console.error(fallback, e);
        if (!silent) setListError(e?.message || fallback);
    };

    const load = useCallback(
        async (silent = false) => {
            if (!silent) setLoading(true);
            try {
                const result = await listPartnerRequests({
                    status: filter,
                    q: search,
                    limit: PAGE_LIMIT,
                    offset: page * PAGE_LIMIT,
                });
                setRequests(result.data || []);
                setTotal(result.total ?? (result.data ? result.data.length : 0));
                setCounts(result.counts || null);
                setListError(null);
            } catch (e: any) {
                handleError(e, 'Не удалось загрузить заявки', silent);
            } finally {
                if (!silent) setLoading(false);
            }
        },
        [filter, search, page],
    );

    useEffect(() => {
        if (!auth) return;
        load();
    }, [auth, load]);

    useEffect(() => {
        if (!auth) return;
        const timer = setInterval(() => load(true), REFRESH_INTERVAL_MS);
        return () => clearInterval(timer);
    }, [auth, load]);

    const run = async (id: number, action: () => Promise<unknown>, fallback: string) => {
        setBusyId(id);
        try {
            await action();
            await load(true);
        } catch (e: any) {
            if (e?.message === 'staff_session_expired') {
                setAuth(null);
                return;
            }
            alert(e?.message || fallback);
        } finally {
            setBusyId(null);
        }
    };

    if (!authChecked || !auth) {
        return (
            <PageShell>
                <AdminNav />
            </PageShell>
        );
    }

    const pages = Math.max(1, Math.ceil(total / PAGE_LIMIT));

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
                        <h1 style={{ ...text.pageTitle, margin: '0 0 6px' }}>Заявки партнёров</h1>
                        <div style={{ ...text.caption, fontWeight: 500 }}>
                            Форма «Стать партнёром» на totus.club/partners · найдено: {total}
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

                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
                    {FILTERS.map((f) => {
                        const active = filter === f.value;
                        const count = f.value && counts ? counts[f.value] : null;
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
                                {count != null ? ` · ${count}` : ''}
                            </button>
                        );
                    })}
                </div>

                <div style={{ position: 'relative', marginBottom: 20, maxWidth: 420 }}>
                    <input
                        type="search"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Поиск: компания, имя, почта, телефон"
                        aria-label="Поиск заявок"
                        style={{ ...inputStyle, width: '100%' }}
                    />
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
                        {loading ? 'Загрузка...' : 'Заявок нет'}
                    </div>
                ) : (
                    <div style={{ display: 'grid', gap: 10 }}>
                        {requests.map((r) => (
                            <RequestCard
                                key={r.id}
                                r={r}
                                busy={busyId === r.id}
                                onStatus={(status) =>
                                    run(r.id, () => updatePartnerRequest(r.id, { status }), 'Не удалось обновить статус')
                                }
                                onSaveNote={(note) =>
                                    run(r.id, () => updatePartnerRequest(r.id, { note }), 'Не удалось сохранить заметку')
                                }
                                onDelete={() => {
                                    if (!confirm(`Удалить заявку № ${r.id} от «${r.company}»?`)) return;
                                    run(r.id, () => deletePartnerRequest(r.id), 'Не удалось удалить заявку');
                                }}
                            />
                        ))}
                    </div>
                )}

                {pages > 1 && (
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'center', marginTop: 18 }}>
                        <button
                            onClick={() => setPage((p) => Math.max(0, p - 1))}
                            disabled={page === 0 || loading}
                            style={{ ...button('secondary', 'sm'), opacity: page === 0 ? 0.5 : 1 }}
                        >
                            <Icon name="arrowLeft" size={14} />
                            Назад
                        </button>
                        <span style={{ ...text.caption }}>
                            {page + 1} из {pages}
                        </span>
                        <button
                            onClick={() => setPage((p) => Math.min(pages - 1, p + 1))}
                            disabled={page >= pages - 1 || loading}
                            style={{ ...button('secondary', 'sm'), opacity: page >= pages - 1 ? 0.5 : 1 }}
                        >
                            Дальше
                            <Icon name="chevronRight" size={14} />
                        </button>
                    </div>
                )}
            </div>
        </PageShell>
    );
}
