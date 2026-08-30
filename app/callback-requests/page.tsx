'use client';

import { useEffect, useMemo, useState } from 'react';
import PageShell from '@/components/PageShell';
import AdminNav from '@/components/AdminNav';
import Icon from '@/components/Icon';
import {
    deleteCallbackRequest,
    formatCallbackDate,
    formatCallbackPhone,
    getCallbackRequests,
    type CallbackRequest,
} from '@/lib/callback-requests-api';
import { t, text, cardStyle, inputStyle, button, badge } from '@/lib/theme';

export default function CallbackRequestsPage() {
    const [requests, setRequests] = useState<CallbackRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');

    const load = async () => {
        try {
            setLoading(true);
            const data = await getCallbackRequests();
            setRequests(data);
        } catch (error) {
            console.error(error);
            alert('Не удалось загрузить заявки с главной страницы');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        load();
    }, []);

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return requests;
        return requests.filter((item) => {
            const phone = item.phone_display || formatCallbackPhone(item.phone);
            return phone.toLowerCase().includes(q) || String(item.id).includes(q);
        });
    }, [requests, search]);

    const handleDelete = async (item: CallbackRequest) => {
        if (!confirm(`Удалить заявку ${formatCallbackPhone(item.phone)}?`)) return;
        try {
            await deleteCallbackRequest(item.id);
            setRequests((prev) => prev.filter((row) => row.id !== item.id));
        } catch (error) {
            console.error(error);
            alert('Не удалось удалить заявку');
        }
    };

    return (
        <PageShell>
            <AdminNav />

            <div style={cardStyle}>
                <div
                    style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start',
                        gap: 16,
                        flexWrap: 'wrap',
                        marginBottom: 24,
                    }}
                >
                    <div>
                        <h1 style={{ margin: 0, ...text.pageTitle }}>Заявки на звонок</h1>
                        <p style={{ margin: '8px 0 0', ...text.body, color: t.textTertiary, maxWidth: 680 }}>
                            Номера телефонов, оставленные на главной странице сайта в блоке «Перезвоните мне».
                        </p>
                    </div>
                    <div style={badge('accent')}>Всего: {requests.length}</div>
                </div>

                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
                    <div style={{ position: 'relative', flex: '1 1 240px', minWidth: 220 }}>
                        <span
                            aria-hidden
                            style={{
                                position: 'absolute',
                                left: 14,
                                top: '50%',
                                transform: 'translateY(-50%)',
                                color: t.textTertiary,
                                display: 'flex',
                            }}
                        >
                            <Icon name="search" size={18} />
                        </span>
                        <input
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Поиск по телефону или ID"
                            style={{ ...inputStyle, paddingLeft: 42, outline: 'none' }}
                        />
                    </div>
                    <button onClick={load} style={button('primary')}>
                        <Icon name="refresh" size={16} />
                        Обновить
                    </button>
                </div>

                {loading ? (
                    <p style={text.caption}>Загрузка...</p>
                ) : filtered.length === 0 ? (
                    <p style={text.caption}>Заявок пока нет.</p>
                ) : (
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 560 }}>
                            <thead>
                                <tr style={{ borderBottom: `1px solid ${t.border}` }}>
                                    {['ID', 'Телефон', 'Дата', 'Действия'].map((title) => (
                                        <th
                                            key={title}
                                            style={{
                                                textAlign: 'left',
                                                padding: '12px 10px',
                                                color: t.textTertiary,
                                                fontSize: 12,
                                                lineHeight: '16px',
                                                fontWeight: 600,
                                                textTransform: 'uppercase',
                                                letterSpacing: '0.04em',
                                            }}
                                        >
                                            {title}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.map((item) => (
                                    <tr key={item.id} style={{ borderBottom: `1px solid ${t.border}` }}>
                                        <td style={{ padding: '14px 10px', ...text.body }}>#{item.id}</td>
                                        <td
                                            style={{
                                                padding: '14px 10px',
                                                ...text.body,
                                                color: t.textPrimary,
                                                fontWeight: 600,
                                            }}
                                        >
                                            <a
                                                href={`tel:+${item.phone}`}
                                                style={{
                                                    display: 'inline-flex',
                                                    alignItems: 'center',
                                                    gap: 8,
                                                    color: t.textPrimary,
                                                    textDecoration: 'none',
                                                }}
                                            >
                                                <Icon name="phone" size={16} style={{ color: t.textTertiary }} />
                                                {item.phone_display || formatCallbackPhone(item.phone)}
                                            </a>
                                        </td>
                                        <td style={{ padding: '14px 10px', ...text.body, color: t.textTertiary }}>
                                            {formatCallbackDate(item.created_at)}
                                        </td>
                                        <td style={{ padding: '14px 10px' }}>
                                            <button onClick={() => handleDelete(item)} style={button('danger', 'sm')}>
                                                <Icon name="delete" size={16} />
                                                Удалить
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </PageShell>
    );
}
