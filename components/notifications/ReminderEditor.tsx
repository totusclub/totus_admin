'use client';

// Редактор правила напоминания (панель справа). Чипы переменных вставляют
// текст в позицию курсора активного поля (заголовок или текст).

import { useEffect, useRef, useState } from 'react';
import Icon from '@/components/Icon';
import { t, radius, text, button, textareaStyle } from '@/lib/theme';
import {
    previewReminderRule,
    type OffsetDirection,
    type OffsetUnit,
    type QuietBehavior,
    type ReminderAudience,
    type ReminderEvent,
    type ReminderPreview,
    type ReminderRule,
    type ReminderRuleBody,
} from '@/lib/push-api';
import PushPreview from './PushPreview';
import {
    Counter,
    ErrorBox,
    EVENT_LABELS,
    Field,
    QUIET_LABELS,
    REMINDER_VARS,
    TYPE_OPTIONS,
    checkboxRow,
    compactInput,
    selectStyle,
} from './shared';

const TITLE_MAX = 40;
const BODY_MAX = 120;
const PREVIEW_DEBOUNCE_MS = 500;

export interface ReminderForm {
    name: string;
    event: ReminderEvent;
    offsetValue: string;
    offsetUnit: OffsetUnit;
    offsetDirection: OffsetDirection;
    sendTime: string;
    quietBehavior: QuietBehavior;
    type: string;
    title: string;
    body: string;
    push: boolean;
    inapp: boolean;
    email: boolean;
    audience: ReminderAudience;
    enabled: boolean;
}

export const EMPTY_RULE: ReminderForm = {
    name: '',
    event: 'departure',
    offsetValue: '3',
    offsetUnit: 'days',
    offsetDirection: 'before',
    sendTime: '10:00',
    quietBehavior: 'shift',
    type: 'trip_reminder',
    title: 'Вылет через {ночей}',
    body: '{дата_вылета} в {время_вылета}, {аэропорт} → {город}. Не забудьте документы.',
    push: true,
    inapp: true,
    email: false,
    audience: 'paid',
    enabled: true,
};

export function ruleToForm(rule: ReminderRule): ReminderForm {
    return {
        name: rule.name || '',
        event: rule.event || 'departure',
        offsetValue: String(rule.offsetValue ?? 0),
        offsetUnit: rule.offsetUnit || 'days',
        offsetDirection: rule.offsetDirection || 'before',
        sendTime: rule.sendTime || '10:00',
        quietBehavior: rule.quietBehavior || 'shift',
        type: rule.type || 'trip_reminder',
        title: rule.title || '',
        body: rule.body || '',
        push: rule.channels?.push !== false,
        inapp: rule.channels?.inapp !== false,
        email: !!rule.channels?.email,
        audience: rule.audience || 'paid',
        enabled: !!rule.enabled,
    };
}

export function formToBody(form: ReminderForm): ReminderRuleBody {
    return {
        name: form.name.trim(),
        event: form.event,
        offsetValue: Number(form.offsetValue) || 0,
        offsetUnit: form.offsetUnit,
        offsetDirection: form.offsetDirection,
        sendTime: form.offsetUnit === 'days' ? form.sendTime : null,
        quietBehavior: form.quietBehavior,
        type: form.type,
        title: form.title.trim(),
        body: form.body.trim(),
        channels: { push: form.push, inapp: form.inapp, email: form.email },
        audience: form.audience,
        enabled: form.enabled,
    };
}

export function validateRule(form: ReminderForm): string | null {
    if (!form.name.trim()) return 'Укажите название правила';
    const offset = Number(form.offsetValue);
    if (!Number.isFinite(offset) || offset < 0 || offset > 365) return 'Смещение — число от 0 до 365';
    if (form.offsetUnit === 'days' && !/^\d{2}:\d{2}$/.test(form.sendTime)) return 'Время отправки в формате ЧЧ:ММ';
    if (!form.title.trim()) return 'Укажите заголовок';
    if (!form.body.trim()) return 'Укажите текст';
    if (form.title.trim().length > 160) return 'Заголовок слишком длинный';
    if (form.body.trim().length > 512) return 'Текст слишком длинный';
    if (!form.push && !form.inapp && !form.email) return 'Выберите хотя бы один канал';
    return null;
}

export default function ReminderEditor({
    form,
    onChange,
    isNew,
    busy,
    error,
    onSave,
    onTest,
    onDelete,
    onClose,
}: {
    form: ReminderForm;
    onChange: (next: ReminderForm) => void;
    isNew: boolean;
    busy: boolean;
    error: string | null;
    onSave: () => void;
    onTest: () => void;
    onDelete: () => void;
    onClose: () => void;
}) {
    const titleRef = useRef<HTMLInputElement | null>(null);
    const bodyRef = useRef<HTMLTextAreaElement | null>(null);
    const lastFocus = useRef<'title' | 'body'>('body');

    const [preview, setPreview] = useState<ReminderPreview | null>(null);
    const [previewError, setPreviewError] = useState<string | null>(null);

    const update = (patch: Partial<ReminderForm>) => onChange({ ...form, ...patch });

    // Предпросмотр на примерных данных сервера (debounce) — только когда заполнены и заголовок, и текст.
    useEffect(() => {
        if (!form.title.trim() || !form.body.trim()) {
            setPreview(null);
            setPreviewError(null);
            return;
        }
        let cancelled = false;
        const timer = setTimeout(async () => {
            try {
                const p = await previewReminderRule({ title: form.title, body: form.body, event: form.event });
                if (!cancelled) {
                    setPreview(p);
                    setPreviewError(null);
                }
            } catch (e: any) {
                if (!cancelled) setPreviewError(e?.message || 'Не удалось построить предпросмотр');
            }
        }, PREVIEW_DEBOUNCE_MS);
        return () => {
            cancelled = true;
            clearTimeout(timer);
        };
    }, [form.title, form.body, form.event]);

    const insertVar = (variable: string) => {
        const isTitle = lastFocus.current === 'title';
        const target: HTMLInputElement | HTMLTextAreaElement | null = isTitle ? titleRef.current : bodyRef.current;
        const value = isTitle ? form.title : form.body;
        const apply = (next: string) => (isTitle ? update({ title: next }) : update({ body: next }));
        if (!target) {
            apply(value + variable);
            return;
        }
        const start = target.selectionStart ?? value.length;
        const end = target.selectionEnd ?? value.length;
        apply(value.slice(0, start) + variable + value.slice(end));
        requestAnimationFrame(() => {
            target.focus();
            const pos = start + variable.length;
            target.setSelectionRange(pos, pos);
        });
    };

    return (
        <div
            style={{
                padding: 20,
                borderRadius: radius.md,
                border: `1px solid ${t.accentBorder}`,
                background: t.surfaceInset,
                display: 'grid',
                gap: 14,
                position: 'sticky',
                top: 24,
            }}
        >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                <h3 style={{ ...text.cardTitle, margin: 0 }}>{isNew ? 'Новое правило' : 'Правило'}</h3>
                <button type="button" onClick={onClose} aria-label="Закрыть" style={{ ...button('tertiary', 'sm'), padding: 6 }}>
                    <Icon name="close" size={18} />
                </button>
            </div>

            <Field label="Название">
                <input style={compactInput} value={form.name} placeholder="За 3 дня до вылета" onChange={(e) => update({ name: e.target.value })} />
            </Field>

            <Field label="Событие">
                <select style={selectStyle} value={form.event} onChange={(e) => update({ event: e.target.value as ReminderEvent })}>
                    {Object.entries(EVENT_LABELS).map(([value, label]) => (
                        <option key={value} value={value}>
                            {label}
                        </option>
                    ))}
                </select>
            </Field>

            <Field label="Смещение">
                <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr 1fr', gap: 8 }}>
                    <input style={compactInput} type="number" min={0} max={365} value={form.offsetValue} onChange={(e) => update({ offsetValue: e.target.value })} />
                    <select style={selectStyle} value={form.offsetUnit} onChange={(e) => update({ offsetUnit: e.target.value as OffsetUnit })}>
                        <option value="hours">часов</option>
                        <option value="days">дней</option>
                    </select>
                    <select style={selectStyle} value={form.offsetDirection} onChange={(e) => update({ offsetDirection: e.target.value as OffsetDirection })}>
                        <option value="before">до</option>
                        <option value="after">после</option>
                    </select>
                </div>
            </Field>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <Field label="Время отправки (МСК)">
                    <input
                        style={{ ...compactInput, opacity: form.offsetUnit === 'days' ? 1 : 0.5 }}
                        type="time"
                        value={form.sendTime}
                        disabled={form.offsetUnit !== 'days'}
                        onChange={(e) => update({ sendTime: e.target.value })}
                    />
                </Field>
                <Field label="В тихие часы">
                    <select style={selectStyle} value={form.quietBehavior} onChange={(e) => update({ quietBehavior: e.target.value as QuietBehavior })}>
                        {Object.entries(QUIET_LABELS).map(([value, label]) => (
                            <option key={value} value={value}>
                                {label}
                            </option>
                        ))}
                    </select>
                </Field>
            </div>

            <Field label="Тип уведомления">
                <select style={selectStyle} value={form.type} onChange={(e) => update({ type: e.target.value })}>
                    {TYPE_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>
                            {o.label}
                        </option>
                    ))}
                </select>
            </Field>

            <Field label="Заголовок" hint={<Counter value={form.title.length} max={TITLE_MAX} />}>
                <input
                    ref={titleRef}
                    style={compactInput}
                    value={form.title}
                    maxLength={160}
                    onFocus={() => {
                        lastFocus.current = 'title';
                    }}
                    onChange={(e) => update({ title: e.target.value })}
                />
            </Field>

            <Field label="Текст" hint={<Counter value={form.body.length} max={BODY_MAX} />}>
                <textarea
                    ref={bodyRef}
                    style={{ ...textareaStyle, minHeight: 80 }}
                    value={form.body}
                    maxLength={512}
                    onFocus={() => {
                        lastFocus.current = 'body';
                    }}
                    onChange={(e) => update({ body: e.target.value })}
                />
            </Field>

            <div>
                <div style={{ ...text.caption, marginBottom: 6 }}>Переменные (вставка в поле с курсором)</div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {REMINDER_VARS.map((v) => (
                        <button
                            key={v}
                            type="button"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => insertVar(v)}
                            style={{
                                ...button('secondary', 'sm'),
                                padding: '3px 8px',
                                fontSize: 12,
                                fontWeight: 500,
                                borderRadius: radius.pill,
                                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                            }}
                        >
                            {v}
                        </button>
                    ))}
                </div>
            </div>

            <div>
                <div style={{ ...text.caption, marginBottom: 6 }}>Предпросмотр</div>
                <PushPreview title={preview?.title ?? form.title} body={preview?.body ?? form.body} />
                {previewError ? <div style={{ ...text.caption, color: t.warning, marginTop: 4 }}>{previewError}</div> : null}
            </div>

            <Field label="Каналы">
                <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
                    <label style={checkboxRow}>
                        <input type="checkbox" checked={form.push} onChange={(e) => update({ push: e.target.checked })} />
                        Push
                    </label>
                    <label style={checkboxRow}>
                        <input type="checkbox" checked={form.inapp} onChange={(e) => update({ inapp: e.target.checked })} />
                        В приложении
                    </label>
                    <label style={checkboxRow}>
                        <input type="checkbox" checked={form.email} onChange={(e) => update({ email: e.target.checked })} />
                        E-mail
                    </label>
                </div>
            </Field>

            <Field label="Аудитория">
                <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
                    <label style={checkboxRow}>
                        <input type="radio" checked={form.audience === 'paid'} onChange={() => update({ audience: 'paid' })} />
                        Оплаченные заказы
                    </label>
                    <label style={checkboxRow}>
                        <input type="radio" checked={form.audience === 'all'} onChange={() => update({ audience: 'all' })} />
                        Все
                    </label>
                </div>
            </Field>

            <label style={checkboxRow}>
                <input type="checkbox" checked={form.enabled} onChange={(e) => update({ enabled: e.target.checked })} />
                Правило включено
            </label>

            <ErrorBox message={error} />

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button type="button" onClick={onSave} disabled={busy} style={{ ...button('primary', 'md'), opacity: busy ? 0.6 : 1 }}>
                    <Icon name="check" size={16} />
                    {busy ? 'Сохранение...' : 'Сохранить'}
                </button>
                {!isNew ? (
                    <>
                        <button type="button" onClick={onTest} disabled={busy} style={button('secondary', 'md')}>
                            Тест себе
                        </button>
                        <button type="button" onClick={onDelete} disabled={busy} style={button('danger', 'md')}>
                            <Icon name="delete" size={16} />
                            Удалить
                        </button>
                    </>
                ) : null}
            </div>
        </div>
    );
}
