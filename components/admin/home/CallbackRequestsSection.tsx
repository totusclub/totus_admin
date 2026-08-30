'use client';

import { useEffect, useMemo, useState } from 'react';
import { deleteCallbackRequest, formatCallbackDate, formatCallbackPhone, getCallbackRequests, type CallbackRequest } from '@/lib/callback-requests-api';
import { badge, button, inputStyle, radius, sectionBox, sectionDesc, sectionTitle, t, text } from '@/lib/theme';
import Icon from '@/components/Icon';

export default function CallbackRequestsSection() {
    const [requests, setRequests] = useState<CallbackRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');

    const load = () => {
        setLoading(true);
        getCallbackRequests().then(setRequests).catch(() => alert('Не удалось загрузить заявки')).finally(() => setLoading(false));
    };

    useEffect(() => { load(); }, []);

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return requests;
        return requests.filter((item) => {
            const phone = item.phone_display || formatCallbackPhone(item.phone);
            return phone.toLowerCase().includes(q) || String(item.id).includes(q);
        });
    }, [requests, search]);

    return (
        <section id="callbacks" style={sectionBox}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
                <div>
                    <h3 style={sectionTitle}>Заявки на звонок</h3>
                    <p style={{ ...sectionDesc, marginBottom: 0, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        Номера из блока «Перезвоните мне».
                        <span style={badge('neutral')}>Всего: {requests.length}</span>
                    </p>
                </div>
                <button onClick={load} style={button('secondary', 'sm')}><Icon name="refresh" size={16} />Обновить</button>
            </div>
            <div style={{ position: 'relative', marginBottom: 16 }}>
                <Icon name="search" size={18} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: t.textTertiary, pointerEvents: 'none' }} />
                <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Поиск по телефону" style={{ ...inputStyle, paddingLeft: 42 }} />
            </div>
            {loading ? <p style={{ ...text.body, color: t.textTertiary }}>Загрузка...</p> : filtered.length === 0 ? <p style={{ ...text.body, color: t.textTertiary }}>Заявок нет.</p> : (
                <div style={{ overflowX: 'auto', borderRadius: radius.md, border: `1px solid ${t.border}`, background: t.surface }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 480 }}>
                        <thead>
                            <tr style={{ borderBottom: `1px solid ${t.border}` }}>
                                {['ID', 'Телефон', 'Дата', ''].map((title) => (
                                    <th key={title} style={{ textAlign: 'left', padding: '12px 16px', ...text.caption, fontWeight: 600 }}>{title}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map((item) => (
                                <tr key={item.id} style={{ borderBottom: `1px solid ${t.border}` }}>
                                    <td style={{ padding: '12px 16px' }}><span style={badge('neutral')}>#{item.id}</span></td>
                                    <td style={{ padding: '12px 16px' }}>
                                        <a href={`tel:+${item.phone}`} style={{ ...text.cardTitle, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                                            <Icon name="phone" size={16} style={{ color: t.textTertiary }} />
                                            {item.phone_display || formatCallbackPhone(item.phone)}
                                        </a>
                                    </td>
                                    <td style={{ padding: '12px 16px', ...text.body, color: t.textTertiary }}>{formatCallbackDate(item.created_at)}</td>
                                    <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                                        <button onClick={async () => { if (!confirm('Удалить?')) return; await deleteCallbackRequest(item.id); setRequests((prev) => prev.filter((row) => row.id !== item.id)); }} style={button('danger', 'sm')}><Icon name="delete" size={16} />Удалить</button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </section>
    );
}
