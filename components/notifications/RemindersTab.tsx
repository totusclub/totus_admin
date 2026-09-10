'use client';

// Вкладка «Напоминания»: список правил слева, редактор справа.

import { useCallback, useEffect, useState } from 'react';
import Icon from '@/components/Icon';
import { t, radius, text, button } from '@/lib/theme';
import {
    createReminderRule,
    deleteReminderRule,
    listReminderRules,
    runReminders,
    testReminderRule,
    toggleReminderRule,
    updateReminderRule,
    type ReminderRule,
} from '@/lib/push-api';
import ReminderEditor, { EMPTY_RULE, formToBody, ruleToForm, validateRule, type ReminderForm } from './ReminderEditor';
import { ErrorBox, SuccessBox, TestPushModal, Toggle, describeRule, formatDateTime, testResultMessage } from './shared';

type Editing = { id: number | null; form: ReminderForm } | null;

export default function RemindersTab({ staffEmail }: { staffEmail: string }) {
    const [rules, setRules] = useState<ReminderRule[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [notice, setNotice] = useState<string | null>(null);
    const [editing, setEditing] = useState<Editing>(null);
    const [editorError, setEditorError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const [rowBusy, setRowBusy] = useState<number | null>(null);
    const [running, setRunning] = useState(false);
    const [testRuleId, setTestRuleId] = useState<number | null>(null);

    const load = useCallback(async (silent = false) => {
        if (!silent) setLoading(true);
        try {
            setRules(await listReminderRules());
            setError(null);
        } catch (e: any) {
            setError(e?.message || 'Не удалось загрузить правила');
        } finally {
            if (!silent) setLoading(false);
        }
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    const openNew = () => {
        setEditing({ id: null, form: EMPTY_RULE });
        setEditorError(null);
    };

    const openEdit = (rule: ReminderRule) => {
        setEditing({ id: rule.id, form: ruleToForm(rule) });
        setEditorError(null);
    };

    const save = async () => {
        if (!editing) return;
        const problem = validateRule(editing.form);
        if (problem) {
            setEditorError(problem);
            return;
        }
        setBusy(true);
        setEditorError(null);
        try {
            const body = formToBody(editing.form);
            if (editing.id) await updateReminderRule(editing.id, body);
            else await createReminderRule(body);
            setNotice(editing.id ? 'Правило сохранено' : 'Правило создано');
            setEditing(null);
            await load(true);
        } catch (e: any) {
            setEditorError(e?.message || 'Не удалось сохранить правило');
        } finally {
            setBusy(false);
        }
    };

    const remove = async (rule: ReminderRule) => {
        if (!confirm(`Удалить правило «${rule.name}»?`)) return;
        setRowBusy(rule.id);
        setError(null);
        try {
            await deleteReminderRule(rule.id);
            if (editing?.id === rule.id) setEditing(null);
            setNotice('Правило удалено');
            await load(true);
        } catch (e: any) {
            setError(e?.message || 'Не удалось удалить правило');
        } finally {
            setRowBusy(null);
        }
    };

    const toggle = async (rule: ReminderRule, enabled: boolean) => {
        setRowBusy(rule.id);
        setError(null);
        setRules((list) => list.map((r) => (r.id === rule.id ? { ...r, enabled } : r)));
        try {
            await toggleReminderRule(rule.id, enabled);
            await load(true);
        } catch (e: any) {
            setError(e?.message || 'Не удалось переключить правило');
            await load(true);
        } finally {
            setRowBusy(null);
        }
    };

    const run = async () => {
        if (!confirm('Прогнать движок напоминаний сейчас? Подходящие по времени напоминания будут отправлены реальным пользователям.')) return;
        setRunning(true);
        setError(null);
        try {
            const result = await runReminders();
            const parts: string[] = [];
            if (typeof result.checked === 'number') parts.push(`проверено ${result.checked}`);
            if (typeof result.sent === 'number') parts.push(`отправлено ${result.sent}`);
            if (typeof result.skipped === 'number') parts.push(`пропущено ${result.skipped}`);
            setNotice(`Движок запущен${parts.length ? `: ${parts.join(' · ')}` : ''}`);
            await load(true);
        } catch (e: any) {
            setError(e?.message || 'Не удалось запустить напоминания');
        } finally {
            setRunning(false);
        }
    };

    const handleTest = async (target: { userId?: number; email?: string }) => {
        if (!testRuleId) return 'Правило не выбрано';
        const result = await testReminderRule(testRuleId, target);
        return testResultMessage(result, 'Тестовое напоминание отправлено по последнему заказу получателя');
    };

    const testRule = rules.find((r) => r.id === testRuleId);

    return (
        <div style={{ display: 'grid', gridTemplateColumns: editing ? 'minmax(0, 1fr) minmax(360px, 460px)' : '1fr', gap: 24, alignItems: 'start' }}>
            <div style={{ display: 'grid', gap: 12 }}>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={text.caption}>
                        Движок проходит по заказам раз в 10 минут; окно отправки — 24 часа после расчётного момента.
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                        <button type="button" onClick={run} disabled={running} style={{ ...button('secondary', 'sm'), opacity: running ? 0.6 : 1 }}>
                            <Icon name="refresh" size={14} />
                            {running ? 'Запуск...' : 'Прогнать сейчас'}
                        </button>
                        <button type="button" onClick={openNew} style={button('primary', 'sm')}>
                            <Icon name="plus" size={14} />
                            Новое правило
                        </button>
                    </div>
                </div>

                <ErrorBox message={error} />
                <SuccessBox message={notice} />

                {rules.length === 0 ? (
                    <div style={{ ...text.caption, padding: 24, textAlign: 'center' }}>{loading ? 'Загрузка...' : 'Правил пока нет — создайте первое'}</div>
                ) : (
                    rules.map((rule) => {
                        const isBusy = rowBusy === rule.id;
                        const active = editing?.id === rule.id;
                        return (
                            <div
                                key={rule.id}
                                style={{
                                    padding: '14px 16px',
                                    borderRadius: radius.md,
                                    border: `1px solid ${active ? t.accentBorder : t.border}`,
                                    background: t.surfaceInset,
                                    display: 'grid',
                                    gap: 8,
                                    opacity: rule.enabled ? 1 : 0.75,
                                }}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ ...text.cardTitle, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{rule.name}</div>
                                        <div style={text.caption}>{describeRule(rule)}</div>
                                    </div>
                                    <Toggle checked={!!rule.enabled} disabled={isBusy} label={rule.enabled ? 'Выключить' : 'Включить'} onChange={(v) => toggle(rule, v)} />
                                </div>
                                <div style={{ ...text.caption, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                                    <span>отправлено {rule.sentCount ?? 0} · открыто {rule.openedCount ?? 0}</span>
                                    {rule.lastSentAt ? <span>последняя отправка {formatDateTime(rule.lastSentAt)}</span> : null}
                                </div>
                                <div style={{ ...text.body, fontSize: 13, color: t.textSecondary }}>
                                    <b style={{ color: t.textPrimary }}>{rule.title}</b>
                                    {rule.body ? ` — ${rule.body}` : ''}
                                </div>
                                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                    <button type="button" disabled={isBusy} onClick={() => openEdit(rule)} style={button('secondary', 'sm')}>
                                        <Icon name="edit" size={14} />
                                        Изменить
                                    </button>
                                    <button type="button" disabled={isBusy} onClick={() => setTestRuleId(rule.id)} style={button('secondary', 'sm')}>
                                        Тест себе
                                    </button>
                                    <button type="button" disabled={isBusy} onClick={() => remove(rule)} style={button('danger', 'sm')}>
                                        <Icon name="delete" size={14} />
                                        Удалить
                                    </button>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            {editing ? (
                <ReminderEditor
                    form={editing.form}
                    onChange={(form) => setEditing({ id: editing.id, form })}
                    isNew={editing.id === null}
                    busy={busy}
                    error={editorError}
                    onSave={save}
                    onTest={() => editing.id && setTestRuleId(editing.id)}
                    onDelete={() => {
                        const rule = rules.find((r) => r.id === editing.id);
                        if (rule) remove(rule);
                    }}
                    onClose={() => setEditing(null)}
                />
            ) : null}

            {testRuleId ? (
                <TestPushModal
                    title={`Тест правила «${testRule?.name || testRuleId}»`}
                    defaultEmail={staffEmail}
                    description="Напоминание будет собрано по последнему заказу выбранного пользователя и отправлено на его устройства."
                    onSubmit={handleTest}
                    onClose={() => setTestRuleId(null)}
                />
            ) : null}
        </div>
    );
}
