'use client';

// Вкладка «Рассылки»: слева форма рассылки, справа предпросмотр баннера
// и список последних рассылок.

import { useCallback, useEffect, useRef, useState } from 'react';
import Icon from '@/components/Icon';
import { t, radius, text, button, textareaStyle } from '@/lib/theme';
import {
    cancelCampaign,
    countAudience,
    createCampaign,
    deleteCampaign,
    listCampaigns,
    sendCampaign,
    sendTestPush,
    updateCampaign,
    type Audience,
    type Campaign,
    type CampaignBody,
    type CampaignType,
    type Segment,
} from '@/lib/push-api';
import PushPreview from './PushPreview';
import SegmentPicker from './SegmentPicker';
import {
    CAMPAIGN_STATUS,
    Counter,
    ErrorBox,
    Field,
    ROUTE_OPTIONS,
    StatusBadge,
    SuccessBox,
    TestPushModal,
    checkboxRow,
    compactInput,
    formatDateTime,
    selectStyle,
} from './shared';

const TITLE_MAX = 40;
const BODY_MAX = 120;
const LIST_LIMIT = 20;
const SENDING_REFRESH_MS = 15_000;
const AUDIENCE_DEBOUNCE_MS = 600;

interface FormState {
    title: string;
    body: string;
    type: CampaignType;
    route: string;
    url: string;
    segment: Segment;
    respectQuietHours: boolean;
    when: 'now' | 'scheduled';
    scheduledAt: string; // datetime-local
}

const EMPTY_FORM: FormState = {
    title: '',
    body: '',
    type: 'promo',
    route: 'home',
    url: '',
    segment: {},
    respectQuietHours: true,
    when: 'now',
    scheduledAt: '',
};

function toLocalInput(iso?: string | null): string {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function campaignToForm(c: Campaign): FormState {
    return {
        title: c.title || '',
        body: c.body || '',
        type: c.type === 'system' ? 'system' : 'promo',
        route: c.data?.route || 'home',
        url: c.data?.url || '',
        segment: c.segment || {},
        respectQuietHours: c.respectQuietHours !== false,
        when: c.scheduledAt ? 'scheduled' : 'now',
        scheduledAt: toLocalInput(c.scheduledAt),
    };
}

export default function CampaignsTab({ staffEmail }: { staffEmail: string }) {
    const [form, setForm] = useState<FormState>(EMPTY_FORM);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [busy, setBusy] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [notice, setNotice] = useState<string | null>(null);
    const [testOpen, setTestOpen] = useState(false);

    const [audience, setAudience] = useState<Audience | null>(null);
    const [audienceState, setAudienceState] = useState<'idle' | 'loading' | 'error'>('idle');
    const audienceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const audienceSeq = useRef(0);

    const [campaigns, setCampaigns] = useState<Campaign[]>([]);
    const [listError, setListError] = useState<string | null>(null);
    const [listLoading, setListLoading] = useState(false);
    const [rowBusy, setRowBusy] = useState<number | null>(null);

    const update = (patch: Partial<FormState>) => setForm((f) => ({ ...f, ...patch }));

    /* ── аудитория (debounce) ────────────────────────────────────────────── */
    const recount = useCallback(async (segment: Segment, type: CampaignType) => {
        const seq = ++audienceSeq.current;
        setAudienceState('loading');
        try {
            const result = await countAudience(segment, type);
            if (seq !== audienceSeq.current) return;
            setAudience(result);
            setAudienceState('idle');
        } catch {
            if (seq !== audienceSeq.current) return;
            setAudienceState('error');
        }
    }, []);

    useEffect(() => {
        if (audienceTimer.current) clearTimeout(audienceTimer.current);
        audienceTimer.current = setTimeout(() => recount(form.segment, form.type), AUDIENCE_DEBOUNCE_MS);
        return () => {
            if (audienceTimer.current) clearTimeout(audienceTimer.current);
        };
    }, [form.segment, form.type, recount]);

    /* ── список рассылок ────────────────────────────────────────────────── */
    const loadList = useCallback(async (silent = false) => {
        if (!silent) setListLoading(true);
        try {
            const result = await listCampaigns({ limit: LIST_LIMIT });
            setCampaigns(result.campaigns || []);
            setListError(null);
        } catch (e: any) {
            if (!silent) setListError(e?.message || 'Не удалось загрузить рассылки');
        } finally {
            if (!silent) setListLoading(false);
        }
    }, []);

    useEffect(() => {
        loadList();
    }, [loadList]);

    const hasSending = campaigns.some((c) => c.status === 'sending');
    useEffect(() => {
        if (!hasSending) return;
        const timer = setInterval(() => loadList(true), SENDING_REFRESH_MS);
        return () => clearInterval(timer);
    }, [hasSending, loadList]);

    /* ── сборка тела ────────────────────────────────────────────────────── */
    const validate = (): string | null => {
        if (!form.title.trim()) return 'Укажите заголовок';
        if (!form.body.trim()) return 'Укажите текст';
        if (form.title.trim().length > TITLE_MAX) return `Заголовок длиннее ${TITLE_MAX} символов`;
        if (form.body.trim().length > BODY_MAX) return `Текст длиннее ${BODY_MAX} символов`;
        if (form.route === 'url') {
            if (!/^https?:\/\//i.test(form.url.trim())) return 'Ссылка должна начинаться с http:// или https://';
        }
        if (form.when === 'scheduled') {
            const d = new Date(form.scheduledAt);
            if (!form.scheduledAt || Number.isNaN(d.getTime())) return 'Укажите дату и время отправки';
            if (d.getTime() < Date.now()) return 'Дата отправки должна быть в будущем';
        }
        return null;
    };

    const buildBody = (extra: Partial<CampaignBody> = {}): CampaignBody => {
        const data: { route?: string; url?: string } = { route: form.route };
        if (form.route === 'url') data.url = form.url.trim();
        return {
            title: form.title.trim(),
            body: form.body.trim(),
            type: form.type,
            data,
            segment: form.segment,
            respectQuietHours: form.respectQuietHours,
            scheduledAt: form.when === 'scheduled' && form.scheduledAt ? new Date(form.scheduledAt).toISOString() : null,
            ...extra,
        };
    };

    const resetForm = () => {
        setForm(EMPTY_FORM);
        setEditingId(null);
    };

    const run = async (key: string, fn: () => Promise<string | null>) => {
        setError(null);
        setNotice(null);
        setBusy(key);
        try {
            const msg = await fn();
            if (msg) setNotice(msg);
            await loadList(true);
        } catch (e: any) {
            setError(e?.message || 'Ошибка');
        } finally {
            setBusy(null);
        }
    };

    const handleSend = () => {
        const problem = validate();
        if (problem) {
            setError(problem);
            return;
        }
        const n = audience?.users ?? null;
        const who = n === null ? 'аудитории' : `${n} получател${n % 10 === 1 && n % 100 !== 11 ? 'ю' : 'ям'}`;
        const whenText = form.when === 'scheduled' ? `запланировать на ${formatDateTime(new Date(form.scheduledAt).toISOString())}` : 'отправить сейчас';
        if (!confirm(`Рассылку «${form.title.trim()}» ${whenText} ${who}?`)) return;

        run('send', async () => {
            if (editingId) {
                await updateCampaign(editingId, buildBody({ draft: false }));
                if (form.when === 'now') await sendCampaign(editingId);
            } else {
                await createCampaign(buildBody());
            }
            resetForm();
            return form.when === 'scheduled' ? 'Рассылка запланирована' : 'Рассылка отправляется';
        });
    };

    const handleDraft = () => {
        if (!form.title.trim() && !form.body.trim()) {
            setError('Черновик пустой — заполните заголовок или текст');
            return;
        }
        run('draft', async () => {
            if (editingId) await updateCampaign(editingId, buildBody({ draft: true }));
            else await createCampaign(buildBody({ draft: true }));
            resetForm();
            return 'Черновик сохранён';
        });
    };

    const handleTest = async (target: { userId?: number; email?: string }) => {
        await sendTestPush({
            ...target,
            title: form.title.trim() || 'Тестовое уведомление',
            body: form.body.trim() || 'Проверка push-уведомлений Totus Club',
            type: form.type,
        });
        return 'Тестовый пуш отправлен';
    };

    /* ── действия в списке ──────────────────────────────────────────────── */
    const rowAction = async (id: number, fn: () => Promise<unknown>) => {
        setRowBusy(id);
        setError(null);
        try {
            await fn();
            await loadList(true);
        } catch (e: any) {
            setError(e?.message || 'Ошибка');
        } finally {
            setRowBusy(null);
        }
    };

    const edit = (c: Campaign) => {
        setForm(campaignToForm(c));
        setEditingId(c.id);
        setError(null);
        setNotice(null);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const titleLen = form.title.length;
    const bodyLen = form.body.length;

    return (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.4fr) minmax(320px, 1fr)', gap: 24, alignItems: 'start' }}>
            {/* ── Форма ────────────────────────────────────────────────────────── */}
            <div style={{ display: 'grid', gap: 16 }}>
                {editingId ? (
                    <div style={{ ...text.caption, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span>Редактирование рассылки №{editingId}</span>
                        <button type="button" onClick={resetForm} style={button('tertiary', 'sm')}>
                            Новая рассылка
                        </button>
                    </div>
                ) : null}

                <Field label="Заголовок" hint={<Counter value={titleLen} max={TITLE_MAX} />}>
                    <input
                        style={compactInput}
                        value={form.title}
                        maxLength={160}
                        placeholder="Горящие туры в Турцию"
                        onChange={(e) => update({ title: e.target.value })}
                    />
                </Field>

                <Field label="Текст" hint={<Counter value={bodyLen} max={BODY_MAX} />}>
                    <textarea
                        style={{ ...textareaStyle, minHeight: 90 }}
                        value={form.body}
                        maxLength={512}
                        placeholder="Анталья, 7 ночей, всё включено — от 45 000 ₽"
                        onChange={(e) => update({ body: e.target.value })}
                    />
                </Field>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <Field label="Тип">
                        <select style={selectStyle} value={form.type} onChange={(e) => update({ type: e.target.value as CampaignType })}>
                            <option value="promo">Акция</option>
                            <option value="system">Важное</option>
                        </select>
                    </Field>
                    <Field label="Куда ведёт">
                        <select style={selectStyle} value={form.route} onChange={(e) => update({ route: e.target.value })}>
                            {ROUTE_OPTIONS.map((r) => (
                                <option key={r.value} value={r.value}>
                                    {r.label}
                                </option>
                            ))}
                        </select>
                    </Field>
                </div>

                {form.route === 'url' ? (
                    <Field label="Ссылка">
                        <input style={compactInput} type="url" placeholder="https://totus.club/..." value={form.url} onChange={(e) => update({ url: e.target.value })} />
                    </Field>
                ) : null}

                {form.type === 'promo' ? (
                    <div style={text.caption}>Акции получают только пользователи, включившие «Акции и предложения» в настройках.</div>
                ) : null}

                <SegmentPicker
                    segment={form.segment}
                    onChange={(segment) => update({ segment })}
                    audience={audience}
                    audienceState={audienceState}
                    onRecount={() => recount(form.segment, form.type)}
                />

                <div style={{ display: 'grid', gap: 10 }}>
                    <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
                        <label style={checkboxRow}>
                            <input type="radio" checked={form.when === 'now'} onChange={() => update({ when: 'now' })} />
                            Отправить сейчас
                        </label>
                        <label style={checkboxRow}>
                            <input type="radio" checked={form.when === 'scheduled'} onChange={() => update({ when: 'scheduled' })} />
                            По расписанию
                        </label>
                        {form.when === 'scheduled' ? (
                            <input
                                type="datetime-local"
                                style={{ ...compactInput, width: 'auto' }}
                                value={form.scheduledAt}
                                onChange={(e) => update({ scheduledAt: e.target.value })}
                            />
                        ) : null}
                    </div>
                    <label style={checkboxRow}>
                        <input type="checkbox" checked={form.respectQuietHours} onChange={(e) => update({ respectQuietHours: e.target.checked })} />
                        Учитывать тихие часы (21:00–09:00 МСК)
                    </label>
                </div>

                <ErrorBox message={error} />
                <SuccessBox message={notice} />

                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <button type="button" onClick={handleSend} disabled={busy !== null} style={{ ...button('primary', 'md'), opacity: busy ? 0.6 : 1 }}>
                        <Icon name="check" size={16} />
                        {busy === 'send' ? 'Отправка...' : form.when === 'scheduled' ? 'Запланировать' : 'Отправить'}
                    </button>
                    <button type="button" onClick={handleDraft} disabled={busy !== null} style={{ ...button('secondary', 'md'), opacity: busy ? 0.6 : 1 }}>
                        {busy === 'draft' ? 'Сохранение...' : 'Сохранить черновик'}
                    </button>
                    <button type="button" onClick={() => setTestOpen(true)} disabled={busy !== null} style={button('secondary', 'md')}>
                        Тестовый пуш себе
                    </button>
                </div>
            </div>

            {/* ── Справа ────────────────────────────────────────────────────────── */}
            <div style={{ display: 'grid', gap: 20 }}>
                <div>
                    <div style={{ ...text.caption, fontWeight: 600, marginBottom: 8 }}>Предпросмотр</div>
                    <PushPreview title={form.title} body={form.body} />
                </div>

                <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                        <div style={{ ...text.caption, fontWeight: 600 }}>Последние рассылки</div>
                        <button type="button" onClick={() => loadList()} disabled={listLoading} style={{ ...button('tertiary', 'sm'), padding: '4px 8px' }}>
                            <Icon name="refresh" size={14} />
                            {listLoading ? 'Обновление...' : 'Обновить'}
                        </button>
                    </div>
                    <ErrorBox message={listError} />
                    {campaigns.length === 0 ? (
                        <div style={{ ...text.caption, padding: '16px 0', textAlign: 'center' }}>{listLoading ? 'Загрузка...' : 'Рассылок пока нет'}</div>
                    ) : (
                        <div style={{ display: 'grid', gap: 8 }}>
                            {campaigns.map((c) => {
                                const meta = CAMPAIGN_STATUS[c.status] || CAMPAIGN_STATUS.draft;
                                const isBusy = rowBusy === c.id;
                                return (
                                    <div
                                        key={c.id}
                                        style={{
                                            padding: '12px 14px',
                                            borderRadius: radius.md,
                                            border: `1px solid ${editingId === c.id ? t.accentBorder : t.border}`,
                                            background: t.surfaceInset,
                                            display: 'grid',
                                            gap: 6,
                                        }}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                            <span style={{ fontSize: 14, fontWeight: 600, color: t.textPrimary, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                {c.title || `Рассылка №${c.id}`}
                                            </span>
                                            <StatusBadge label={meta.label} tone={meta.tone} />
                                        </div>
                                        <div style={text.caption}>
                                            №{c.id} · {c.type === 'system' ? 'Важное' : 'Акция'} ·{' '}
                                            {c.status === 'scheduled' && c.scheduledAt ? `на ${formatDateTime(c.scheduledAt)}` : formatDateTime(c.finishedAt || c.startedAt || c.createdAt)}
                                        </div>
                                        <div style={text.caption}>
                                            отправлено {c.sentCount ?? 0} · открыто {c.openedCount ?? 0}
                                            {c.failedCount ? ` · ошибок ${c.failedCount}` : ''}
                                            {c.audienceCount != null ? ` · аудитория ${c.audienceCount}` : ''}
                                        </div>
                                        {c.error ? <div style={{ ...text.caption, color: c.error.startsWith('deferred:') ? t.warning : t.error }}>{c.error.startsWith('deferred:') ? `Отложено до утра: ${c.error.slice(9)}` : c.error}</div> : null}
                                        {(c.status === 'draft' || c.status === 'scheduled' || c.status === 'cancelled' || c.status === 'failed') ? (
                                            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                                {c.status === 'draft' ? (
                                                    <>
                                                        <button
                                                            type="button"
                                                            disabled={isBusy}
                                                            onClick={() => {
                                                                if (!confirm(`Отправить черновик «${c.title}» сейчас?`)) return;
                                                                rowAction(c.id, () => sendCampaign(c.id));
                                                            }}
                                                            style={button('primary', 'sm')}
                                                        >
                                                            Отправить
                                                        </button>
                                                        <button type="button" disabled={isBusy} onClick={() => edit(c)} style={button('secondary', 'sm')}>
                                                            <Icon name="edit" size={14} />
                                                            Изменить
                                                        </button>
                                                    </>
                                                ) : null}
                                                {c.status === 'scheduled' ? (
                                                    <>
                                                        <button type="button" disabled={isBusy} onClick={() => edit(c)} style={button('secondary', 'sm')}>
                                                            <Icon name="edit" size={14} />
                                                            Изменить
                                                        </button>
                                                        <button
                                                            type="button"
                                                            disabled={isBusy}
                                                            onClick={() => {
                                                                if (!confirm(`Отменить запланированную рассылку «${c.title}»?`)) return;
                                                                rowAction(c.id, () => cancelCampaign(c.id));
                                                            }}
                                                            style={button('danger', 'sm')}
                                                        >
                                                            Отменить
                                                        </button>
                                                    </>
                                                ) : null}
                                                {c.status !== 'scheduled' ? (
                                                    <button
                                                        type="button"
                                                        disabled={isBusy}
                                                        onClick={() => {
                                                            if (!confirm(`Удалить рассылку «${c.title}»?`)) return;
                                                            rowAction(c.id, () => deleteCampaign(c.id));
                                                        }}
                                                        style={button('danger', 'sm')}
                                                    >
                                                        <Icon name="delete" size={14} />
                                                        Удалить
                                                    </button>
                                                ) : null}
                                            </div>
                                        ) : null}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>

            {testOpen ? (
                <TestPushModal
                    title="Тестовый пуш себе"
                    defaultEmail={staffEmail}
                    description="Отправим заголовок и текст из формы на устройства выбранного пользователя."
                    onSubmit={handleTest}
                    onClose={() => setTestOpen(false)}
                />
            ) : null}
        </div>
    );
}
