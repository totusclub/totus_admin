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
import { t, text, button, badge } from '@/lib/theme';
import { PageHeader, Toolbar, SearchInput, RefreshButton, pageCard, emptyTextStyle } from '@/components/PageKit';
import { TableWrap, tableStyle, thStyle, tdStyle } from '@/components/rooms/shared';

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

            <div style={pageCard}>
                <PageHeader
                    title="Заявки на звонок"
                    subtitle="Номера телефонов, оставленные на главной странице сайта в блоке «Перезвоните мне»."
                    actions={
                        <>
                            <span style={badge('accent')}>Всего: {requests.length}</span>
                            <RefreshButton onClick={load} loading={loading} />
                        </>
                    }
                />

                <Toolbar>
                    <SearchInput value={search} onChange={setSearch} placeholder="Поиск по телефону или ID" />
                </Toolbar>

                {loading ? (
                    <div style={emptyTextStyle}>Загрузка...</div>
                ) : filtered.length === 0 ? (
                    <div style={emptyTextStyle}>Заявок пока нет.</div>
                ) : (
                    <TableWrap>
                        <table style={{ ...tableStyle, minWidth: 560 }}>
                            <thead>
                                <tr>
                                    {['ID', 'Телефон', 'Дата', 'Действия'].map((title) => (
                                        <th key={title} style={thStyle}>
                                            {title}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.map((item) => (
                                    <tr key={item.id}>
                                        <td style={{ ...tdStyle, ...text.body }}>#{item.id}</td>
                                        <td
                                            style={{
                                                ...tdStyle,
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
                                        <td style={{ ...tdStyle, ...text.body, color: t.textTertiary }}>
                                            {formatCallbackDate(item.created_at)}
                                        </td>
                                        <td style={tdStyle}>
                                            <button onClick={() => handleDelete(item)} style={button('danger', 'sm')}>
                                                <Icon name="delete" size={16} />
                                                Удалить
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </TableWrap>
                )}
            </div>
        </PageShell>
    );
}
