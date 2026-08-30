'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import PageShell from '@/components/PageShell';
import AdminNav from '@/components/AdminNav';
import Icon from '@/components/Icon';
import { t, radius, text, cardStyle, inputStyle, button, badge } from '@/lib/theme';
import { getAllUsers, getUserDisplayName, type User } from '@/lib/users-api';

export default function UsersPage() {
    const router = useRouter();
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState('');

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

            <div style={cardStyle}>
                <div
                    style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: 12,
                        flexWrap: 'wrap',
                        marginBottom: 20,
                    }}
                >
                    <div>
                        <h1 style={{ ...text.pageTitle, margin: '0 0 6px' }}>
                            Пользователи
                        </h1>
                        <div style={text.caption}>
                            Всего: {users.length} · Онлайн: {onlineCount}
                        </div>
                    </div>
                    <button
                        onClick={loadUsers}
                        disabled={loading}
                        style={{
                            ...button('secondary', 'md'),
                            cursor: loading ? 'not-allowed' : 'pointer',
                            opacity: loading ? 0.6 : 1,
                        }}
                    >
                        <Icon name="refresh" size={16} />
                        {loading ? 'Обновление...' : 'Обновить'}
                    </button>
                </div>

                <div style={{ position: 'relative', marginBottom: 20 }}>
                    <span
                        style={{
                            position: 'absolute',
                            left: 16,
                            top: '50%',
                            transform: 'translateY(-50%)',
                            color: t.textTertiary,
                            display: 'flex',
                            pointerEvents: 'none',
                        }}
                    >
                        <Icon name="search" size={18} />
                    </span>
                    <input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Поиск по имени, email, телефону, ID..."
                        style={{ ...inputStyle, padding: '12px 16px 12px 46px', outline: 'none' }}
                    />
                </div>

                {filtered.length === 0 ? (
                    <div style={{ padding: 24, textAlign: 'center', ...text.body, color: t.textTertiary }}>
                        {loading ? 'Загрузка...' : 'Пользователи не найдены'}
                    </div>
                ) : (
                    <div style={{ display: 'grid', gap: 10 }}>
                        {filtered.map((user) => (
                            <div
                                key={user.id}
                                style={{
                                    padding: '16px 18px',
                                    borderRadius: radius.md,
                                    border: `1px solid ${t.border}`,
                                    background: t.surface,
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
                                            background: user.online ? t.success : t.surfaceInset,
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
                        ))}
                    </div>
                )}
            </div>
        </PageShell>
    );
}
