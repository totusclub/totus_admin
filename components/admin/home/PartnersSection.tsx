'use client';

import { useEffect, useRef, useState } from 'react';
import { createHomePartner, deleteHomePartner, getHomePartners, updateHomePartner, type HomePartner } from '@/lib/home-partners-api';
import { badge, button, inputStyle, radius, sectionBox, sectionDesc, sectionTitle, t, text } from '@/lib/theme';
import Icon from '@/components/Icon';

function PartnerForm({ initial, onSave, onCancel, saving }: { initial?: HomePartner | null; onSave: (values: { name: string; url: string; sort_order: number; image?: File | null }) => Promise<void>; onCancel?: () => void; saving: boolean }) {
    const [name, setName] = useState(initial?.name || '');
    const [url, setUrl] = useState(initial?.url || '');
    const [sortOrder, setSortOrder] = useState(String(initial?.sort_order ?? 0));
    const [file, setFile] = useState<File | null>(null);
    const [preview, setPreview] = useState(initial?.image || '');
    const fileRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        setName(initial?.name || '');
        setUrl(initial?.url || '');
        setSortOrder(String(initial?.sort_order ?? 0));
        if (!file) setPreview(initial?.image || '');
    }, [initial?.id, initial?.name, initial?.url, initial?.sort_order, initial?.image, file]);

    return (
        <div style={{ display: 'grid', gap: 10 }}>
            <div style={{ height: 90, borderRadius: radius.md, border: `1px solid ${t.border}`, background: preview ? `center/contain no-repeat url(${preview})` : t.surfaceInset }} />
            <label style={{ ...button('secondary', 'sm'), width: 'fit-content' }}>
                <Icon name="upload" size={16} />
                {initial ? 'Заменить логотип' : 'Выбрать логотип'}
                <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => { const next = e.target.files?.[0] || null; if (!next) return; setFile(next); setPreview(URL.createObjectURL(next)); }} />
            </label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Название" style={inputStyle} />
            <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="Ссылка" style={inputStyle} />
            <input value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} type="number" placeholder="Порядок" style={inputStyle} />
            <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={async () => { if (!initial && !file) { alert('Загрузите логотип'); return; } await onSave({ name, url, sort_order: Number(sortOrder) || 0, image: file }); setFile(null); if (fileRef.current) fileRef.current.value = ''; }} disabled={saving} style={{ ...button('primary'), opacity: saving ? 0.6 : 1 }}>{saving ? 'Сохранение...' : initial ? 'Сохранить' : 'Добавить'}</button>
                {onCancel && <button onClick={onCancel} style={button('secondary')}>Отмена</button>}
            </div>
        </div>
    );
}

export default function PartnersSection() {
    const [partners, setPartners] = useState<HomePartner[]>([]);
    const [loading, setLoading] = useState(true);
    const [showCreate, setShowCreate] = useState(false);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [saving, setSaving] = useState(false);

    const load = () => {
        setLoading(true);
        getHomePartners().then(setPartners).catch(() => alert('Не удалось загрузить партнёров')).finally(() => setLoading(false));
    };

    useEffect(() => { load(); }, []);

    return (
        <section id="partners" style={sectionBox}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
                <div>
                    <h3 style={sectionTitle}>Партнёры</h3>
                    <p style={{ ...sectionDesc, marginBottom: 0, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        Логотипы партнёров на главной.
                        <span style={badge('neutral')}>Всего: {partners.length}</span>
                    </p>
                </div>
                <button onClick={() => { setShowCreate((v) => !v); setEditingId(null); }} style={button('primary', 'sm')}>
                    {showCreate ? <Icon name="close" size={16} /> : <Icon name="plus" size={16} />}
                    {showCreate ? 'Скрыть' : 'Добавить'}
                </button>
            </div>
            {showCreate && (
                <div style={{ marginBottom: 16, padding: 16, borderRadius: radius.md, border: `1px solid ${t.border}`, background: t.surface }}>
                    <PartnerForm saving={saving} onCancel={() => setShowCreate(false)} onSave={async (values) => {
                        if (!values.image) return;
                        setSaving(true);
                        try {
                            const created = await createHomePartner({ name: values.name, url: values.url, sort_order: values.sort_order, image: values.image });
                            setPartners((prev) => [...prev, created].sort((a, b) => a.sort_order - b.sort_order || a.id - b.id));
                            setShowCreate(false);
                        } catch (error) {
                            alert(error instanceof Error ? error.message : 'Ошибка');
                        } finally { setSaving(false); }
                    }} />
                </div>
            )}
            {loading ? <p style={{ ...text.body, color: t.textTertiary }}>Загрузка...</p> : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
                    {partners.map((item) => (
                        <div key={item.id} style={{ padding: 16, borderRadius: radius.md, border: `1px solid ${t.border}`, background: t.surface }}>
                            {editingId === item.id ? (
                                <PartnerForm initial={item} saving={saving} onCancel={() => setEditingId(null)} onSave={async (values) => {
                                    setSaving(true);
                                    try {
                                        const updated = await updateHomePartner(item.id, values);
                                        setPartners((prev) => prev.map((p) => (p.id === item.id ? updated : p)).sort((a, b) => a.sort_order - b.sort_order || a.id - b.id));
                                        setEditingId(null);
                                    } catch (error) {
                                        alert(error instanceof Error ? error.message : 'Ошибка');
                                    } finally { setSaving(false); }
                                }} />
                            ) : (
                                <>
                                    <div style={{ height: 70, marginBottom: 12, borderRadius: radius.sm, background: `center/contain no-repeat url(${item.image})` }} />
                                    <p style={{ margin: '0 0 12px', ...text.cardTitle }}>{item.name || `Партнёр #${item.id}`}</p>
                                    <div style={{ display: 'flex', gap: 8 }}>
                                        <button onClick={() => { setEditingId(item.id); setShowCreate(false); }} style={button('secondary', 'sm')}><Icon name="edit" size={16} />Изменить</button>
                                        <button onClick={async () => { if (!confirm('Удалить?')) return; await deleteHomePartner(item.id); setPartners((prev) => prev.filter((p) => p.id !== item.id)); }} style={button('danger', 'sm')}><Icon name="delete" size={16} />Удалить</button>
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
