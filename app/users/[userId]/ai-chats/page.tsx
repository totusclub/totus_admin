'use client';

import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react';
import { useParams, useRouter } from 'next/navigation';
import PageShell from '@/components/PageShell';
import AdminNav from '@/components/AdminNav';
import Icon from '@/components/Icon';
import { PageHeader, SearchInput, RefreshButton, pageCard, emptyTextStyle, blockTitle } from '@/components/PageKit';
import { t, radius, text, button, badge } from '@/lib/theme';
import { getUserById, getUserDisplayName, type User } from '@/lib/users-api';
import {
    getUserAiChats,
    getAiChat,
    formatChatTime,
    formatPrice,
    chatAsText,
    type AiChat,
    type AiChatListItem,
    type AiChatMessage,
} from '@/lib/ai-chats-api';

/**
 * Чаты пользователя с Машей (ИИ-ассистент): слева — все его чаты, справа — выбранный
 * чат целиком, вопросы пользователя и ответы Маши. Только просмотр.
 */
export default function UserAiChatsPage() {
    const router = useRouter();
    const params = useParams<{ userId: string }>();
    const userId = Number(params?.userId);

    const [user, setUser] = useState<User | null>(null);
    const [chats, setChats] = useState<AiChatListItem[]>([]);
    const [listLoading, setListLoading] = useState(false);
    const [listError, setListError] = useState('');
    const [activeId, setActiveId] = useState<string>('');
    const [chat, setChat] = useState<AiChat | null>(null);
    const [chatLoading, setChatLoading] = useState(false);
    const [chatError, setChatError] = useState('');
    const [query, setQuery] = useState('');
    const [copied, setCopied] = useState(false);

    const userName = user ? getUserDisplayName(user) : `Пользователь #${userId}`;

    const loadList = useCallback(async () => {
        if (!Number.isInteger(userId) || userId <= 0) return;
        setListLoading(true);
        setListError('');
        try {
            const list = await getUserAiChats(userId);
            setChats(list);
            setActiveId((current) => (current && list.some((c) => c.id === current) ? current : list[0]?.id || ''));
        } catch (e) {
            console.error('Failed to load AI chats:', e);
            setListError('Не удалось загрузить чаты');
        } finally {
            setListLoading(false);
        }
    }, [userId]);

    useEffect(() => {
        loadList();
        if (Number.isInteger(userId) && userId > 0) {
            getUserById(userId).then(setUser).catch(() => setUser(null));
        }
    }, [loadList, userId]);

    useEffect(() => {
        if (!activeId) {
            setChat(null);
            return;
        }
        let cancelled = false;
        setChatLoading(true);
        setChatError('');
        setQuery('');
        getAiChat(activeId)
            .then((c) => {
                if (!cancelled) setChat(c);
            })
            .catch((e) => {
                console.error('Failed to load AI chat:', e);
                if (!cancelled) {
                    setChat(null);
                    setChatError('Не удалось загрузить чат');
                }
            })
            .finally(() => {
                if (!cancelled) setChatLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, [activeId]);

    const messages = useMemo(() => {
        const list = (chat?.messages || []).filter((m) => m.role !== 'system');
        const q = query.trim().toLowerCase();
        if (!q) return list;
        return list.filter((m) => m.text.toLowerCase().includes(q));
    }, [chat, query]);

    const copyChat = async () => {
        if (!chat) return;
        try {
            await navigator.clipboard.writeText(chatAsText(chat, userName));
            setCopied(true);
            window.setTimeout(() => setCopied(false), 2000);
        } catch {
            alert('Не удалось скопировать');
        }
    };

    const backButton = (
        <button type="button" onClick={() => router.push('/users')} style={{ ...button('tertiary', 'sm'), alignSelf: 'flex-start', paddingLeft: 0 }}>
            <Icon name="arrowLeft" size={16} />
            Пользователи
        </button>
    );

    return (
        <PageShell>
            <AdminNav />

            <div style={pageCard}>
                <PageHeader
                    before={backButton}
                    title="Чаты с Машей"
                    subtitle={
                        <span>
                            {userName}
                            {user?.loyaltyId ? ` · ID ${user.loyaltyId}` : ''}
                            {` · #${Number.isFinite(userId) ? userId : '—'}`}
                            {` · Чатов: ${chats.length}`}
                        </span>
                    }
                    actions={<RefreshButton onClick={loadList} loading={listLoading} />}
                />

                {listError ? (
                    <div style={{ ...emptyTextStyle, color: t.error }}>{listError}</div>
                ) : chats.length === 0 ? (
                    <div style={emptyTextStyle}>{listLoading ? 'Загрузка...' : 'У пользователя нет чатов с Машей'}</div>
                ) : (
                    <div style={splitStyle}>
                        <aside aria-label="История чатов" style={listColumnStyle}>
                            <div style={{ ...text.caption, padding: '0 4px 4px' }}>История чатов</div>
                            {chats.map((c) => {
                                const active = c.id === activeId;
                                return (
                                    <button
                                        key={c.id}
                                        type="button"
                                        onClick={() => setActiveId(c.id)}
                                        aria-current={active ? 'true' : undefined}
                                        style={{
                                            ...chatItemStyle,
                                            background: active ? t.accentSoft : t.surfaceInset,
                                            borderColor: active ? t.accentBorder : t.border,
                                        }}
                                    >
                                        <span style={{ ...text.cardTitle, fontSize: 14, lineHeight: '20px', color: active ? t.accent : t.textPrimary, ...clamp(1) }}>
                                            {c.title}
                                        </span>
                                        {c.preview && c.preview !== c.title ? (
                                            <span style={{ ...text.body, fontSize: 13, lineHeight: '18px', ...clamp(2) }}>{c.preview}</span>
                                        ) : null}
                                        <span style={{ ...text.caption, fontSize: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                            <span>{formatChatTime(c.updatedAt)}</span>
                                            <span style={{ color: t.textDisabled }}>•</span>
                                            <span>Сообщений: {c.messagesCount}</span>
                                        </span>
                                    </button>
                                );
                            })}
                        </aside>

                        <section aria-label="Переписка" style={chatColumnStyle}>
                            {chatLoading && !chat ? (
                                <div style={emptyTextStyle}>Загрузка...</div>
                            ) : chatError ? (
                                <div style={{ ...emptyTextStyle, color: t.error }}>{chatError}</div>
                            ) : chat ? (
                                <>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
                                        <div style={{ minWidth: 0, flex: '1 1 260px' }}>
                                            <h2 style={{ ...blockTitle, overflowWrap: 'anywhere' }}>{chat.title}</h2>
                                            <div style={{ ...text.caption, marginTop: 4 }}>
                                                Начат {formatChatTime(chat.createdAt)} · Последнее сообщение {formatChatTime(chat.updatedAt)} · Сообщений: {chat.messages.length}
                                            </div>
                                        </div>
                                        <button type="button" onClick={copyChat} style={button('secondary', 'sm')}>
                                            <Icon name={copied ? 'check' : 'file'} size={16} />
                                            {copied ? 'Скопировано' : 'Скопировать чат'}
                                        </button>
                                    </div>

                                    <div style={{ display: 'flex' }}>
                                        <SearchInput value={query} onChange={setQuery} placeholder="Поиск по переписке" />
                                    </div>

                                    <div style={messagesStyle}>
                                        {messages.length === 0 ? (
                                            <div style={emptyTextStyle}>{query ? 'Ничего не найдено' : 'В чате нет сообщений'}</div>
                                        ) : (
                                            messages.map((m) => <MessageBubble key={m.id} message={m} userName={userName} />)
                                        )}
                                    </div>

                                    <div style={{ ...text.caption, fontSize: 12 }}>
                                        Хранятся последние 80 сообщений каждого чата. Чаты, которые пользователь удалил, не показываются. Личные данные в сохранённых сообщениях скрыты.
                                    </div>
                                </>
                            ) : (
                                <div style={emptyTextStyle}>Выберите чат</div>
                            )}
                        </section>
                    </div>
                )}
            </div>
        </PageShell>
    );
}

function MessageBubble({ message, userName }: { message: AiChatMessage; userName: string }) {
    const mine = message.role === 'user';
    const cards = message.cards;
    return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: mine ? 'flex-end' : 'flex-start', gap: 6 }}>
            <div style={{ ...text.caption, fontSize: 12, display: 'flex', gap: 8, alignItems: 'center' }}>
                <span style={{ fontWeight: 600, color: mine ? t.textSecondary : t.accent }}>{mine ? userName : 'Маша'}</span>
                <span>{formatChatTime(message.at)}</span>
            </div>
            {message.text ? (
                <div
                    style={{
                        maxWidth: '78%',
                        padding: '10px 14px',
                        borderRadius: radius.md,
                        borderTopRightRadius: mine ? 4 : radius.md,
                        borderTopLeftRadius: mine ? radius.md : 4,
                        background: mine ? t.accentSoft : t.surfaceInset,
                        border: `1px solid ${mine ? t.accentBorder : t.border}`,
                        ...text.body,
                        color: t.textPrimary,
                        whiteSpace: 'pre-wrap',
                        overflowWrap: 'anywhere',
                    }}
                >
                    {message.text}
                </div>
            ) : null}

            {cards?.steps?.length ? (
                <div style={{ ...text.caption, fontSize: 12, maxWidth: '78%' }}>{cards.steps.join(' · ')}</div>
            ) : null}

            {cards?.tours?.length ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 8, width: '78%' }}>
                    {cards.tours.map((tour, i) => (
                        <div key={i} style={miniCardStyle}>
                            {tour.label ? <span style={{ ...badge('accent'), alignSelf: 'flex-start' }}>{tour.label}</span> : null}
                            <span style={{ ...text.cardTitle, fontSize: 14, lineHeight: '20px' }}>
                                {tour.name || 'Отель'}
                                {tour.stars ? ` ${'★'.repeat(Math.min(5, Math.round(tour.stars)))}` : ''}
                            </span>
                            <span style={{ ...text.caption, fontSize: 12 }}>{[tour.destination, tour.nights].filter(Boolean).join(' · ')}</span>
                            {tour.price !== null ? <span style={{ fontSize: 14, fontWeight: 600, color: t.textPrimary }}>{formatPrice(tour.price, tour.currency)}</span> : null}
                            {tour.link ? (
                                <a href={tour.link} target="_blank" rel="noopener noreferrer" style={linkStyle}>
                                    Открыть на сайте
                                    <Icon name="linkExternal" size={14} />
                                </a>
                            ) : null}
                        </div>
                    ))}
                    {cards.toursTotal ? <div style={{ ...text.caption, fontSize: 12, alignSelf: 'center' }}>Всего вариантов: {cards.toursTotal}</div> : null}
                </div>
            ) : null}

            {cards?.rooms?.rooms.length ? (
                <div style={{ ...miniCardStyle, width: '78%' }}>
                    <span style={{ ...text.cardTitle, fontSize: 14, lineHeight: '20px' }}>Номера{cards.rooms.hotel ? `: ${cards.rooms.hotel}` : ''}</span>
                    {cards.rooms.rooms.map((r, i) => (
                        <span key={i} style={{ ...text.body, fontSize: 13, display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                            <span>{r.roomType || 'Номер'}</span>
                            <span style={{ whiteSpace: 'nowrap' }}>от {formatPrice(r.minPrice, r.currency)}</span>
                        </span>
                    ))}
                </div>
            ) : null}

            {cards?.destinations?.length ? (
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', maxWidth: '78%' }}>
                    {cards.destinations.map((d, i) => (
                        <span key={i} style={badge('neutral')}>
                            {[d.name, d.country].filter(Boolean).join(', ')}
                        </span>
                    ))}
                </div>
            ) : null}

            {cards?.booking ? (
                <div style={{ ...miniCardStyle, width: '78%' }}>
                    <span style={{ ...text.cardTitle, fontSize: 14, lineHeight: '20px' }}>Заявка {cards.booking.id || ''}</span>
                    <span style={{ ...text.caption, fontSize: 12 }}>
                        {[cards.booking.tour, cards.booking.date, cards.booking.guests ? `гостей: ${cards.booking.guests}` : null, cards.booking.total ? formatPrice(cards.booking.total) : null]
                            .filter(Boolean)
                            .join(' · ')}
                    </span>
                </div>
            ) : null}
        </div>
    );
}

function clamp(lines: number): CSSProperties {
    return { display: '-webkit-box', WebkitLineClamp: lines, WebkitBoxOrient: 'vertical', overflow: 'hidden', overflowWrap: 'anywhere' };
}

const splitStyle: CSSProperties = {
    display: 'flex',
    gap: 20,
    alignItems: 'stretch',
    flexWrap: 'wrap',
    minWidth: 0,
};

const listColumnStyle: CSSProperties = {
    flex: '0 1 300px',
    minWidth: 240,
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    maxHeight: 'calc(100vh - 48px)',
    overflowY: 'auto',
    paddingRight: 4,
    position: 'sticky',
    top: 24,
    alignSelf: 'flex-start',
};

const chatItemStyle: CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    width: '100%',
    padding: '12px 14px',
    borderRadius: radius.md,
    border: `1px solid ${t.border}`,
    textAlign: 'left',
    cursor: 'pointer',
    fontFamily: 'inherit',
    transition: 'background 0.15s, border-color 0.15s',
};

const chatColumnStyle: CSSProperties = {
    flex: '1 1 480px',
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
    padding: 20,
    borderRadius: radius.md,
    border: `1px solid ${t.border}`,
    background: t.surface,
};

const messagesStyle: CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
};

const miniCardStyle: CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    padding: 12,
    borderRadius: radius.sm,
    border: `1px solid ${t.border}`,
    background: t.surface,
};

const linkStyle: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    fontSize: 13,
    fontWeight: 600,
    color: t.accent,
    textDecoration: 'none',
};
