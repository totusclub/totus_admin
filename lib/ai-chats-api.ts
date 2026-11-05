// История чатов пользователей с Машей (ИИ-ассистент) — только просмотр.
// Данные отдаёт totus_API: GET /api/admin/ai-chats* (только staff; Bearer ставит lib/http.ts).
import { API_BASE_URL } from './server';

const BASE = `${API_BASE_URL}/api/admin/ai-chats`;

export interface AiChatSummary {
    chats: number;
    lastAt: number | null;
}

export interface AiChatListItem {
    id: string;
    title: string;
    preview: string | null;
    messagesCount: number;
    userMessages: number;
    createdAt: number | null;
    updatedAt: number | null;
}

export interface AiTourCard {
    name: string | null;
    destination: string | null;
    price: number | null;
    currency: string | null;
    stars: number | null;
    nights: string | null;
    label: string | null;
    comment: string | null;
    link: string | null;
}

export interface AiMessageCards {
    tours?: AiTourCard[];
    toursTotal?: number;
    rooms?: {
        hotel: string | null;
        rooms: { roomType: string | null; minPrice: number | null; currency: string | null; link: string | null }[];
    };
    destinations?: { name: string | null; country: string | null }[];
    booking?: {
        id: string | null;
        status: string | null;
        tour: string | null;
        date: string | null;
        guests: number | null;
        total: number | null;
    };
    steps?: string[];
}

export interface AiChatMessage {
    id: string;
    role: 'user' | 'assistant' | 'system';
    text: string;
    at: number | null;
    cards: AiMessageCards | null;
}

export interface AiChat {
    id: string;
    userId: number;
    title: string;
    createdAt: number | null;
    updatedAt: number | null;
    messages: AiChatMessage[];
}

async function getJson<T>(url: string): Promise<T> {
    const response = await fetch(url, { cache: 'no-store' });
    if (!response.ok) {
        const err = new Error(`ai-chats ${response.status}`) as Error & { status?: number };
        err.status = response.status;
        throw err;
    }
    return response.json() as Promise<T>;
}

/** Число чатов по каждому пользователю (для кнопки в списке пользователей). */
export async function getAiChatSummary(): Promise<Record<string, AiChatSummary>> {
    const data = await getJson<{ users?: Record<string, AiChatSummary> }>(`${BASE}/summary`);
    return data.users || {};
}

export async function getUserAiChats(userId: number): Promise<AiChatListItem[]> {
    const data = await getJson<{ chats?: AiChatListItem[] }>(`${BASE}?userId=${encodeURIComponent(String(userId))}`);
    return data.chats || [];
}

export async function getAiChat(chatId: string): Promise<AiChat> {
    const data = await getJson<{ chat: AiChat }>(`${BASE}/${encodeURIComponent(chatId)}`);
    return data.chat;
}

/** «05.11.2026, 14:32» по Москве — как время заказов в админке. */
export function formatChatTime(ms: number | null | undefined): string {
    if (!ms) return '—';
    return new Date(ms).toLocaleString('ru-RU', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Europe/Moscow',
    });
}

export function formatPrice(value: number | null | undefined, currency?: string | null): string {
    if (value === null || value === undefined) return '';
    const sign = !currency || currency === 'RUB' ? '₽' : currency;
    return `${Math.round(value).toLocaleString('ru-RU')} ${sign}`;
}

/** Переписка текстом — для кнопки «Скопировать чат». */
export function chatAsText(chat: AiChat, userName: string): string {
    const lines = [`${chat.title}`, ''];
    for (const m of chat.messages) {
        const who = m.role === 'user' ? userName : m.role === 'assistant' ? 'Маша' : 'Система';
        lines.push(`[${formatChatTime(m.at)}] ${who}:`);
        if (m.text) lines.push(m.text);
        for (const t of m.cards?.tours || []) {
            lines.push(`  • ${[t.name, t.destination, formatPrice(t.price, t.currency)].filter(Boolean).join(', ')}${t.link ? ` — ${t.link}` : ''}`);
        }
        lines.push('');
    }
    return lines.join('\n');
}
