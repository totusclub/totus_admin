'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import PageShell from '@/components/PageShell';
import AdminNav from '@/components/AdminNav';
import Icon from '@/components/Icon';
import { PageHeader, Toolbar, SearchInput, RefreshButton, pageCard, listStyle, listItemStyle, emptyTextStyle } from '@/components/PageKit';
import { t, radius, text, button, badge } from '@/lib/theme';
import { getAllUsers, getUserDisplayName, type User } from '@/lib/users-api';
import { getAiChatSummary, type AiChatSummary } from '@/lib/ai-chats-api';

export default function UsersPage() {
    const router = useRouter();
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState('');
    const [aiChats, setAiChats] = useState<Record<string, AiChatSummary>>({});

    const loadUsers = async () => {
        try {
            setLoading(true);
            const all = await getAllUsers();
            setUsers(all);
        } catch (e) {
            console.error('Failed to load users:', e);
            alert('Не удалось загрузить список пользователей');
        } finally {
            setLoading(false);
        }
        // Число чатов с Машей — для кнопки; если не загрузилось, кнопка остаётся без числа.
        getAiChatSummary()
            .then(setAiChats)
            .catch((e) => console.error('Failed to load AI chat summary:', e));
    };

    useEffect(() => {
        loadUsers();
    }, []);

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return users;
        return users.filter((u) => {
            const haystack = [
                getUserDisplayName(u),
                u.email,
                u.phone,
                u.loyaltyId,
                String(u.id),
            ]
                .filter(Boolean)
                .join(' ')
                .toLowerCase();
            return haystack.includes(q);
        });
    }, [users, search]);

    const onlineCount = users.filter((u) => u.online).length;

    return (
        <PageShell>
            <AdminNav />

            <div style={pageCard}>
                <PageHeader
                    title="Пользователи"
                    subtitle={`Всего: ${users.length} · Онлайн: ${onlineCount}`}
                    actions={<RefreshButton onClick={loadUsers} loading={loading} />}
                />

                <Toolbar>
                    <SearchInput value={search} onChange={setSearch} placeholder="Поиск по имени, email, телефону, ID..." />
                </Toolbar>

                {filtered.length === 0 ? (
                    <div style={emptyTextStyle}>
                        {loading ? 'Загрузка...' : 'Пользователи не найдены'}
                    </div>
                ) : (
                    <div style={listStyle}>
                        {filtered.map((user) => (
                            <div
                                key={user.id}
                                style={{
                                    ...listItemStyle,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    gap: 16,
                                }}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0, flex: 1 }}>
                                    <div
                                        style={{
                                            width: 44,
                                            height: 44,
                                            borderRadius: radius.pill,
                                            flexShrink: 0,
                                            border: user.online ? 'none' : `1px solid ${t.border}`,
                                            background: user.online ? t.success : t.surface,
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            color: user.online ? t.textOnAccent : t.textSecondary,
                                            fontWeight: 600,
                                            fontSize: 18,
                                        }}
                                    >
                                        {getUserDisplayName(user).charAt(0).toUpperCase()}
                                    </div>
                                    <div style={{ minWidth: 0 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4, flexWrap: 'wrap' }}>
                                            <strong
                                                style={{
                                                    ...text.cardTitle,
                                                    whiteSpace: 'nowrap',
                                                    overflow: 'hidden',
                                                    textOverflow: 'ellipsis',
                                                }}
                                            >
                                                {getUserDisplayName(user)}
                                            </strong>
                                            <span
                                                style={{
                                                    ...badge(user.online ? 'success' : 'neutral'),
                                                    whiteSpace: 'nowrap',
                                                }}
                                            >
                                                {user.online ? 'Онлайн' : 'Офлайн'}
                                            </span>
                                            {user.access === 1 || user.access === true ? (
                                                <span style={{ ...badge('error'), whiteSpace: 'nowrap' }}>Заблок.</span>
                                            ) : null}
                                        </div>
                                        <div
                                            style={{
                                                ...text.caption,
                                                fontSize: 12,
                                                display: 'flex',
                                                flexWrap: 'wrap',
                                                gap: 8,
                                                alignItems: 'center',
                                            }}
                                        >
                                            <span>ID: <strong style={{ color: t.accent }}>{user.loyaltyId}</strong></span>
                                            <span style={{ color: t.textDisabled }}>•</span>
                                            <span>#{user.id}</span>
                                            {user.phone && (
                                                <>
                                                    <span style={{ color: t.textDisabled }}>•</span>
                                                    <span>{user.phone}</span>
                                                </>
                                            )}
                                            {user.email && (
                                                <>
                                                    <span style={{ color: t.textDisabled }}>•</span>
                                                    <span>{user.email}</span>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                                    <button
                                        onClick={() => router.push(`/users/${user.id}/ai-chats`)}
                                        style={button('secondary', 'md')}
                                    >
                                        Чаты с Машей
                                        {aiChats[String(user.id)]?.chats ? (
                                            <span style={{ ...badge('neutral'), padding: '0 8px', lineHeight: '20px' }}>{aiChats[String(user.id)].chats}</span>
                                        ) : null}
                                        <Icon name="chevronRight" size={16} />
                                    </button>
                                    <button
                                        onClick={() => router.push(`/orders?userId=${user.id}`)}
                                        style={{
                                            ...button('secondary', 'md'),
                                            background: t.accentSoft,
                                            color: t.accent,
                                            border: `1px solid ${t.accentBorder}`,
                                        }}
                                    >
                                        Заказы
                                        <Icon name="chevronRight" size={16} />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </PageShell>
    );
}
