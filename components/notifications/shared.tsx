'use client';

// Общие справочники, форматирование и мелкие UI-примитивы раздела «Уведомления».

import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import Icon, { type IconName } from '@/components/Icon';
import { t, radius, text, button, badge, inputStyle } from '@/lib/theme';
import type { CampaignStatus, PushStatus, ReminderRule, TestPushBody } from '@/lib/push-api';

export type BadgeTone = NonNullable<Parameters<typeof badge>[0]>;

/* ── Справочники ──────────────────────────────────────────────────────── */

export const CAMPAIGN_STATUS: Record<CampaignStatus, { label: string; tone: BadgeTone }> = {
    draft: { label: 'Черновик', tone: 'neutral' },
    scheduled: { label: 'Запланировано', tone: 'info' },
    sending: { label: 'Отправляется', tone: 'accent' },
    sent: { label: 'Отправлено', tone: 'success' },
    failed: { label: 'Ошибка', tone: 'error' },
    cancelled: { label: 'Отменено', tone: 'neutral' },
};

export const PUSH_STATUS: Record<PushStatus, { label: string; tone: BadgeTone }> = {
    sent: { label: 'Отправлено', tone: 'success' },
    failed: { label: 'Ошибка', tone: 'error' },
    deferred: { label: 'Отложено', tone: 'warning' },
    no_devices: { label: 'Без устройств', tone: 'neutral' },
    none: { label: 'В приложении', tone: 'info' },
    skipped: { label: 'Пропущено', tone: 'neutral' },
    pending: { label: 'В очереди', tone: 'accent' },
};

/** Тип уведомления → русское название, категория и иконка (цвета — по DESIGN.md). */
export const TYPE_META: Record<string, { label: string; category: string; icon: IconName; color: string }> = {
    order_created: { label: 'Заказ создан', category: 'orders', icon: 'luggage', color: '#FE732E' },
    payment_success: { label: 'Оплата прошла', category: 'orders', icon: 'check', color: '#288556' },
    payment_failed: { label: 'Оплата не прошла', category: 'orders', icon: 'close', color: '#CF3030' },
    order_request_status: { label: 'Ответ по обращению', category: 'orders', icon: 'mail', color: '#FE732E' },
    order_confirmed: { label: 'Тур подтверждён', category: 'documents', icon: 'file', color: '#2BA9E2' },
    order_status: { label: 'Статус заказа', category: 'documents', icon: 'file', color: '#2BA9E2' },
    order_cancelled: { label: 'Заказ отменён', category: 'documents', icon: 'file', color: '#2BA9E2' },
    documents_ready: { label: 'Документы готовы', category: 'documents', icon: 'file', color: '#2BA9E2' },
    trip_reminder: { label: 'Напоминание о поездке', category: 'reminders', icon: 'calendar', color: '#5856D6' },
    support_message: { label: 'Сообщение поддержки', category: 'support', icon: 'mail', color: '#2BA9E2' },
    missed_call: { label: 'Пропущенный звонок', category: 'support', icon: 'phone', color: '#2BA9E2' },
    promo: { label: 'Акция', category: 'promo', icon: 'globe', color: '#FF9500' },
    system: { label: 'Важное', category: 'system', icon: 'info', color: '#7A7A7A' },
};

export const TYPE_OPTIONS = Object.entries(TYPE_META).map(([value, meta]) => ({ value, label: meta.label }));

export function typeMeta(type: string) {
    return TYPE_META[type] || { label: type, category: 'system', icon: 'info' as IconName, color: '#7A7A7A' };
}

export const ROUTE_OPTIONS: { value: string; label: string }[] = [
    { value: 'home', label: 'Главная' },
    { value: 'search', label: 'Поиск' },
    { value: 'url', label: 'Ссылка URL' },
    { value: 'orders', label: 'Заказы' },
];

export const EVENT_LABELS: Record<string, string> = {
    departure: 'Вылет',
    checkin: 'Заезд',
    trip_end: 'Окончание поездки',
    order_created: 'Создание заказа',
};

export const QUIET_LABELS: Record<string, string> = {
    shift: 'Перенести на утро',
    skip: 'Не отправлять',
    send: 'Отправить',
};

export const REMINDER_VARS = [
    '{имя}', '{номер}', '{город}', '{страна}', '{отель}', '{дата_вылета}',
    '{время_вылета}', '{аэропорт}', '{ночей}', '{дата_окончания}',
];

/* ── Форматирование ───────────────────────────────────────────────────── */

export function formatDateTime(value?: string | null): string {
    if (!value) return '—';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return value;
    return d.toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function formatDate(value?: string | null): string {
    if (!value) return '—';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return value;
    return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function plural(n: number, one: string, few: string, many: string): string {
    const abs = Math.abs(n) % 100;
    const last = abs % 10;
    if (abs > 10 && abs < 20) return many;
    if (last > 1 && last < 5) return few;
    if (last === 1) return one;
    return many;
}

/** «Вылет − 3 дня · 10:00 МСК» из event/offset/sendTime. */
export function describeRule(rule: Pick<ReminderRule, 'event' | 'offsetValue' | 'offsetUnit' | 'offsetDirection' | 'sendTime'>): string {
    const event = EVENT_LABELS[rule.event] || rule.event;
    const value = Number(rule.offsetValue) || 0;
    const unit = rule.offsetUnit === 'hours'
        ? plural(value, 'час', 'часа', 'часов')
        : plural(value, 'день', 'дня', 'дней');
    const sign = rule.offsetDirection === 'after' ? '+' : '−';
    const offset = value === 0 ? 'в момент события' : `${sign} ${value} ${unit}`;
    const time = rule.offsetUnit === 'days' && rule.sendTime ? ` · ${rule.sendTime} МСК` : '';
    return `${event} ${offset}${time}`;
}

/** «Рассылка №12» / «Напоминание „За сутки до вылета“» / «Тест напоминания №3» / «Поддержка» / «Заказы (API)» / «Тест» / «Система». */
export function describeSource(source: string | undefined, ruleNames: Record<number, string>): string {
    if (!source) return 'Система';
    const campaign = /^campaign:(\d+)$/.exec(source);
    if (campaign) return `Рассылка №${campaign[1]}`;
    const reminderTest = /^reminder_test:(\d+)$/.exec(source);
    if (reminderTest) return `Тест напоминания №${reminderTest[1]}`;
    const reminder = /^reminder:(\d+)$/.exec(source);
    if (reminder) {
        const name = ruleNames[Number(reminder[1])];
        return name ? `Напоминание „${name}“` : `Напоминание №${reminder[1]}`;
    }
    if (source === 'support_chat') return 'Поддержка';
    if (source === 'totus_api') return 'Заказы (API)';
    if (source === 'test') return 'Тест';
    return 'Система';
}

/** Текст результата тестовой отправки: хаб отвечает { recipients, push: {sent, ...} }. */
export function testResultMessage(result: Record<string, unknown> | null | undefined, okText = 'Тестовый пуш отправлен'): string {
    const recipients = typeof result?.recipients === 'number' ? result.recipients : null;
    const push = result?.push as { sent?: number } | undefined;
    const sent = typeof push?.sent === 'number' ? push.sent : null;
    if (recipients === 0 || sent === 0) {
        return 'Отправлено, но получатель не найден, категория отключена или нет устройств';
    }
    return okText;
}

export function userDisplay(user?: { name?: string | null; email?: string | null } | null, userId?: number): { name: string; email: string } {
    const name = user?.name?.trim() || (userId ? `Пользователь #${userId}` : '—');
    return { name, email: user?.email || '' };
}

/* ── Примитивы форм ───────────────────────────────────────────────────── */

export const fieldLabel: CSSProperties = {
    display: 'block',
    marginBottom: 6,
    fontSize: 13,
    lineHeight: '18px',
    fontWeight: 600,
    color: t.textPrimary,
};

export const compactInput: CSSProperties = { ...inputStyle, padding: '9px 12px' };
export const selectStyle: CSSProperties = { ...compactInput, cursor: 'pointer' };
export const checkboxRow: CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 14, color: t.textPrimary, cursor: 'pointer' };

export function Field({ label, hint, children }: { label: ReactNode; hint?: ReactNode; children: ReactNode }) {
    return (
        <div>
            <label style={fieldLabel}>
                <span style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                    <span>{label}</span>
                    {hint ? <span style={{ ...text.caption, fontWeight: 400 }}>{hint}</span> : null}
                </span>
            </label>
            {children}
        </div>
    );
}

export function Counter({ value, max }: { value: number; max: number }) {
    return <span style={{ color: value > max ? t.error : t.textTertiary }}>{value}/{max}</span>;
}

export function ErrorBox({ message }: { message: string | null }) {
    if (!message) return null;
    return (
        <div
            style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
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
            <span>{message}</span>
        </div>
    );
}

export function SuccessBox({ message }: { message: string | null }) {
    if (!message) return null;
    return (
        <div
            style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '10px 12px',
                background: t.successSoft,
                border: `1px solid ${t.success}`,
                borderRadius: radius.sm,
                color: t.success,
                fontSize: 13,
                lineHeight: '18px',
            }}
        >
            <Icon name="check" size={16} />
            <span>{message}</span>
        </div>
    );
}

export function Toggle({ checked, onChange, disabled, label }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean; label?: string }) {
    return (
        <button
            type="button"
            role="switch"
            aria-checked={checked}
            aria-label={label}
            title={label}
            disabled={disabled}
            onClick={() => onChange(!checked)}
            style={{
                width: 44,
                height: 26,
                borderRadius: radius.pill,
                border: 'none',
                padding: 3,
                background: checked ? t.accent : t.borderStrong,
                cursor: disabled ? 'not-allowed' : 'pointer',
                opacity: disabled ? 0.5 : 1,
                display: 'inline-flex',
                justifyContent: checked ? 'flex-end' : 'flex-start',
                transition: 'background 0.15s',
                flexShrink: 0,
            }}
        >
            <span style={{ width: 20, height: 20, borderRadius: radius.pill, background: '#ffffff', display: 'block' }} />
        </button>
    );
}

/* ── Модальное окно ───────────────────────────────────────────────────── */

export function Modal({ title, onClose, children, width = 480 }: { title: string; onClose: () => void; children: ReactNode; width?: number }) {
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onClose]);

    return (
        <div
            onClick={onClose}
            style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(0, 0, 0, 0.45)',
                zIndex: 100,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 24,
            }}
        >
            <div
                role="dialog"
                aria-modal
                aria-label={title}
                onClick={(e) => e.stopPropagation()}
                style={{
                    width: '100%',
                    maxWidth: width,
                    maxHeight: '90vh',
                    overflowY: 'auto',
                    background: t.surface,
                    border: `1px solid ${t.border}`,
                    borderRadius: radius.lg,
                    boxShadow: t.shadowRaised,
                    padding: 24,
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 16 }}>
                    <h2 style={{ ...text.sectionTitle, margin: 0 }}>{title}</h2>
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label="Закрыть"
                        style={{ ...button('tertiary', 'sm'), padding: 6 }}
                    >
                        <Icon name="close" size={18} />
                    </button>
                </div>
                {children}
            </div>
        </div>
    );
}

/* ── Модал «Тестовый пуш себе» ────────────────────────────────────────── */

export function TestPushModal({
    title,
    defaultEmail,
    description,
    onSubmit,
    onClose,
}: {
    title: string;
    defaultEmail: string;
    description?: string;
    /** Возвращает текст успеха. */
    onSubmit: (target: Pick<TestPushBody, 'userId' | 'email'>) => Promise<string>;
    onClose: () => void;
}) {
    const [mode, setMode] = useState<'email' | 'userId'>('email');
    const [email, setEmail] = useState(defaultEmail);
    const [userId, setUserId] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [done, setDone] = useState<string | null>(null);

    const submit = async () => {
        setError(null);
        setDone(null);
        const target: Pick<TestPushBody, 'userId' | 'email'> = {};
        if (mode === 'email') {
            if (!email.trim()) {
                setError('Укажите e-mail получателя');
                return;
            }
            target.email = email.trim();
        } else {
            const id = Number(userId);
            if (!id) {
                setError('Укажите числовой ID пользователя');
                return;
            }
            target.userId = id;
        }
        setBusy(true);
        try {
            setDone(await onSubmit(target));
        } catch (e: any) {
            setError(e?.message || 'Не удалось отправить тест');
        } finally {
            setBusy(false);
        }
    };

    return (
        <Modal title={title} onClose={onClose}>
            <div style={{ display: 'grid', gap: 14 }}>
                {description ? <div style={text.body}>{description}</div> : null}
                <div style={{ display: 'flex', gap: 16 }}>
                    <label style={checkboxRow}>
                        <input type="radio" checked={mode === 'email'} onChange={() => setMode('email')} />
                        По e-mail
                    </label>
                    <label style={checkboxRow}>
                        <input type="radio" checked={mode === 'userId'} onChange={() => setMode('userId')} />
                        По ID пользователя
                    </label>
                </div>
                {mode === 'email' ? (
                    <Field label="E-mail получателя" hint="по умолчанию — ваш">
                        <input style={compactInput} type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
                    </Field>
                ) : (
                    <Field label="ID пользователя">
                        <input style={compactInput} type="number" min={1} value={userId} onChange={(e) => setUserId(e.target.value)} />
                    </Field>
                )}
                <ErrorBox message={error} />
                <SuccessBox message={done} />
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                    <button type="button" onClick={onClose} style={button('secondary', 'md')}>
                        Закрыть
                    </button>
                    <button type="button" onClick={submit} disabled={busy} style={{ ...button('primary', 'md'), opacity: busy ? 0.6 : 1 }}>
                        {busy ? 'Отправка...' : 'Отправить'}
                    </button>
                </div>
            </div>
        </Modal>
    );
}

export function StatusBadge({ label, tone }: { label: string; tone: BadgeTone }) {
    return <span style={{ ...badge(tone), fontSize: 11, padding: '3px 10px', whiteSpace: 'nowrap' }}>{label}</span>;
}
