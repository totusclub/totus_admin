'use client';

import { useEffect, useState } from 'react';
import {
    createFooterSocialLink,
    deleteFooterSocialLink,
    getFooterSocialIcons,
    getFooterSocialLinks,
    updateFooterSocialLink,
    type FooterSocialLink,
} from '@/lib/footer-social-api';
import { badge, button, inputStyle, radius, sectionBox, sectionDesc, sectionTitle, t, text } from '@/lib/theme';
import Icon from '@/components/Icon';

const ICON_LABELS: Record<string, string> = {
    vk: 'VK',
    rutube: 'Rutube',
    aiStar: 'AI Star',
    vc: 'VC',
    instagram: 'Instagram',
    fb: 'Facebook',
    x: 'X',
    youtube: 'YouTube',
};

function SocialForm({
    initial,
    icons,
    onSave,
    onCancel,
    saving,
}: {
    initial?: FooterSocialLink | null;
    icons: string[];
    onSave: (values: { title: string; icon: string; url: string; sort_order: number; is_active: boolean }) => Promise<void>;
    onCancel?: () => void;
    saving: boolean;
}) {
    const [title, setTitle] = useState(initial?.title || '');
    const [icon, setIcon] = useState(initial?.icon || icons[0] || 'vk');
    const [url, setUrl] = useState(initial?.url || '');
    const [sortOrder, setSortOrder] = useState(String(initial?.sort_order ?? 0));
    const [isActive, setIsActive] = useState(initial?.is_active ?? true);

    useEffect(() => {
        setTitle(initial?.title || '');
        setIcon(initial?.icon || icons[0] || 'vk');
        setUrl(initial?.url || '');
        setSortOrder(String(initial?.sort_order ?? 0));
        setIsActive(initial?.is_active ?? true);
    }, [initial?.id, initial?.title, initial?.icon, initial?.url, initial?.sort_order, initial?.is_active, icons]);

    return (
        <div style={{ display: 'grid', gap: 10 }}>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Название (необязательно)" style={inputStyle} />
            <select value={icon} onChange={(e) => setIcon(e.target.value)} style={inputStyle}>
                {icons.map((name) => (
                    <option key={name} value={name}>
                        {ICON_LABELS[name] || name}
                    </option>
                ))}
            </select>
            <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="Ссылка (https://...)" style={inputStyle} />
            <input value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} type="number" placeholder="Порядок" style={inputStyle} />
            <label style={{ ...text.body, color: t.textSecondary, display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
                Показывать в футере
            </label>
            <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => onSave({ title, icon, url, sort_order: Number(sortOrder) || 0, is_active: isActive })} disabled={saving} style={{ ...button('primary'), opacity: saving ? 0.6 : 1 }}>
                    {saving ? 'Сохранение...' : initial ? 'Сохранить' : 'Добавить'}
                </button>
                {onCancel && <button onClick={onCancel} style={button('secondary')}>Отмена</button>}
            </div>
        </div>
    );
}

export default function FooterSocialSection() {
    const [items, setItems] = useState<FooterSocialLink[]>([]);
    const [icons, setIcons] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);
    const [showCreate, setShowCreate] = useState(false);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [saving, setSaving] = useState(false);

    const load = () => {
        setLoading(true);
        Promise.all([getFooterSocialLinks(), getFooterSocialIcons()])
            .then(([links, iconList]) => {
                setItems(links);
                setIcons(iconList);
            })
            .catch(() => alert('Не удалось загрузить соцсети'))
            .finally(() => setLoading(false));
    };

    useEffect(() => { load(); }, []);

    return (
        <section id="footer-social" style={sectionBox}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
                <div>
                    <h3 style={sectionTitle}>Соцсети в футере</h3>
                    <p style={{ ...sectionDesc, marginBottom: 0, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        Иконки и ссылки в подвале сайта.
                        <span style={badge('neutral')}>Всего: {items.length}</span>
                    </p>
                </div>
                <button onClick={() => { setShowCreate((v) => !v); setEditingId(null); }} style={button('primary', 'sm')}>
                    {showCreate ? <Icon name="close" size={16} /> : <Icon name="plus" size={16} />}
                    {showCreate ? 'Скрыть' : 'Добавить'}
                </button>
            </div>

            {showCreate && (
                <div style={{ marginBottom: 16, padding: 16, borderRadius: radius.md, border: `1px solid ${t.border}`, background: t.surface }}>
                    <SocialForm
                        icons={icons}
                        saving={saving}
                        onCancel={() => setShowCreate(false)}
                        onSave={async (values) => {
                            setSaving(true);
                            try {
                                const created = await createFooterSocialLink(values);
                                setItems((prev) => [...prev, created].sort((a, b) => a.sort_order - b.sort_order));
                                setShowCreate(false);
                            } catch (error) {
                                alert(error instanceof Error ? error.message : 'Ошибка');
                            } finally {
                                setSaving(false);
                            }
                        }}
                    />
                </div>
            )}

            {loading ? <p style={{ ...text.body, color: t.textTertiary }}>Загрузка...</p> : (
                <div style={{ display: 'grid', gap: 12 }}>
                    {items.map((item) => (
                        <div key={item.id} style={{ padding: 16, borderRadius: radius.md, border: `1px solid ${t.border}`, background: t.surface }}>
                            {editingId === item.id ? (
                                <SocialForm
                                    initial={item}
                                    icons={icons}
                                    saving={saving}
                                    onCancel={() => setEditingId(null)}
                                    onSave={async (values) => {
                                        setSaving(true);
                                        try {
                                            const updated = await updateFooterSocialLink(item.id, values);
                                            setItems((prev) => prev.map((row) => (row.id === item.id ? updated : row)).sort((a, b) => a.sort_order - b.sort_order));
                                            setEditingId(null);
                                        } catch (error) {
                                            alert(error instanceof Error ? error.message : 'Ошибка');
                                        } finally {
                                            setSaving(false);
                                        }
                                    }}
                                />
                            ) : (
                                <>
                                    <p style={{ margin: '0 0 6px', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', ...text.cardTitle }}>
                                        {item.title || ICON_LABELS[item.icon] || item.icon}
                                        {!item.is_active && <span style={badge('warning')}>скрыто</span>}
                                    </p>
                                    <p style={{ margin: '0 0 6px', ...text.caption }}>Иконка: {item.icon} · Порядок: {item.sort_order}</p>
                                    {item.url ? (
                                        <a href={item.url} target="_blank" rel="noopener noreferrer" style={{ ...text.caption, color: t.accent, display: 'inline-flex', alignItems: 'center', gap: 6, textDecoration: 'none', wordBreak: 'break-all' }}>
                                            <Icon name="linkExternal" size={16} />
                                            {item.url}
                                        </a>
                                    ) : (
                                        <p style={{ margin: 0, ...text.caption, color: t.textTertiary }}>Ссылка не указана</p>
                                    )}
                                    <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                                        <button onClick={() => { setEditingId(item.id); setShowCreate(false); }} style={button('secondary', 'sm')}><Icon name="edit" size={16} />Изменить</button>
                                        <button onClick={async () => { if (!confirm('Удалить?')) return; await deleteFooterSocialLink(item.id); setItems((prev) => prev.filter((row) => row.id !== item.id)); }} style={button('danger', 'sm')}><Icon name="delete" size={16} />Удалить</button>
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
