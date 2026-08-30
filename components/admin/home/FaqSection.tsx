'use client';

import { useEffect, useMemo, useState } from 'react';
import { createFaqItem, deleteFaqItem, getFaqItems, updateFaqItem, type FaqItem } from '@/lib/faq-api';
import { badge, button, inputStyle, radius, sectionBox, sectionDesc, sectionTitle, t, text, textareaStyle } from '@/lib/theme';
import Icon from '@/components/Icon';

function FaqForm({ initial, onSave, onCancel, saving }: { initial?: FaqItem | null; onSave: (values: { question: string; answer: string }) => Promise<void>; onCancel?: () => void; saving: boolean }) {
    const [question, setQuestion] = useState(initial?.question || '');
    const [answer, setAnswer] = useState(initial?.answer || '');

    useEffect(() => {
        setQuestion(initial?.question || '');
        setAnswer(initial?.answer || '');
    }, [initial?.id, initial?.question, initial?.answer]);

    return (
        <div style={{ display: 'grid', gap: 10 }}>
            <input value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="Вопрос" style={inputStyle} />
            <textarea value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder="Ответ" style={textareaStyle} />
            <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => onSave({ question, answer })} disabled={saving || !question.trim() || !answer.trim()} style={{ ...button('primary'), opacity: saving || !question.trim() || !answer.trim() ? 0.6 : 1 }}>{saving ? 'Сохранение...' : initial ? 'Сохранить' : 'Добавить'}</button>
                {onCancel && <button onClick={onCancel} style={button('secondary')}>Отмена</button>}
            </div>
        </div>
    );
}

export default function FaqSection() {
    const [items, setItems] = useState<FaqItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [editingId, setEditingId] = useState<number | null>(null);
    const [showCreate, setShowCreate] = useState(false);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        getFaqItems().then(setItems).catch(() => alert('Не удалось загрузить FAQ')).finally(() => setLoading(false));
    }, []);

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return items;
        return items.filter((item) => item.question.toLowerCase().includes(q) || item.answer.toLowerCase().includes(q));
    }, [items, search]);

    return (
        <section id="faq" style={sectionBox}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
                <div>
                    <h3 style={sectionTitle}>FAQ</h3>
                    <p style={{ ...sectionDesc, marginBottom: 0, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        Вопросы и ответы на главной.
                        <span style={badge('neutral')}>Всего: {items.length}</span>
                    </p>
                </div>
                <button onClick={() => { setShowCreate((v) => !v); setEditingId(null); }} style={button('primary', 'sm')}>
                    {showCreate ? <Icon name="close" size={16} /> : <Icon name="plus" size={16} />}
                    {showCreate ? 'Скрыть' : 'Добавить вопрос'}
                </button>
            </div>
            <div style={{ position: 'relative', marginBottom: 16 }}>
                <Icon name="search" size={18} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: t.textTertiary, pointerEvents: 'none' }} />
                <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Поиск" style={{ ...inputStyle, paddingLeft: 42 }} />
            </div>
            {showCreate && (
                <div style={{ marginBottom: 16, padding: 16, borderRadius: radius.md, border: `1px solid ${t.border}`, background: t.surface }}>
                    <FaqForm saving={saving} onCancel={() => setShowCreate(false)} onSave={async (values) => {
                        setSaving(true);
                        try {
                            const created = await createFaqItem(values);
                            setItems((prev) => [...prev, created].sort((a, b) => a.id - b.id));
                            setShowCreate(false);
                        } catch (error) {
                            alert(error instanceof Error ? error.message : 'Ошибка');
                        } finally { setSaving(false); }
                    }} />
                </div>
            )}
            {loading ? <p style={{ ...text.body, color: t.textTertiary }}>Загрузка...</p> : (
                <div style={{ display: 'grid', gap: 12 }}>
                    {filtered.map((item) => (
                        <div key={item.id} style={{ padding: 16, borderRadius: radius.md, border: `1px solid ${t.border}`, background: t.surface }}>
                            {editingId === item.id ? (
                                <FaqForm initial={item} saving={saving} onCancel={() => setEditingId(null)} onSave={async (values) => {
                                    setSaving(true);
                                    try {
                                        const updated = await updateFaqItem({ id: item.id, ...values });
                                        setItems((prev) => prev.map((row) => (row.id === item.id ? updated : row)));
                                        setEditingId(null);
                                    } catch (error) {
                                        alert(error instanceof Error ? error.message : 'Ошибка');
                                    } finally { setSaving(false); }
                                }} />
                            ) : (
                                <>
                                    <p style={{ margin: '0 0 8px', ...text.cardTitle }}>{item.question}</p>
                                    <p style={{ margin: '0 0 12px', ...text.body, whiteSpace: 'pre-wrap' }}>{item.answer}</p>
                                    <div style={{ display: 'flex', gap: 8 }}>
                                        <button onClick={() => { setEditingId(item.id); setShowCreate(false); }} style={button('secondary', 'sm')}><Icon name="edit" size={16} />Изменить</button>
                                        <button onClick={async () => { if (!confirm('Удалить?')) return; await deleteFaqItem(item.id); setItems((prev) => prev.filter((row) => row.id !== item.id)); }} style={button('danger', 'sm')}><Icon name="delete" size={16} />Удалить</button>
                                    </div>
                                </>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </section>
    );
}
