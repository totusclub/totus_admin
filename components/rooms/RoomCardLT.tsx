'use client';

// Карточка номера Level.Travel внутри группы оператора (GET /hotels/:id/rooms → operators[].rooms[]).

import type { ReactNode } from 'react';
import Icon from '@/components/Icon';
import { t, radius, text, cardStyle, button, badge } from '@/lib/theme';
import { formatMoney, type OperatorRoom } from '@/lib/rooms-api';
import { Thumb, plural } from './shared';

export function roomMeta(room: OperatorRoom['room'], meals?: string[]): string {
    const parts: string[] = [];
    if (room?.area) parts.push(`${room.area} м²`);
    if (room?.view) parts.push(String(room.view));
    if (room?.accommodation) parts.push(String(room.accommodation));
    if (meals?.length) parts.push(meals.join(', '));
    return parts.join(' · ');
}

export default function RoomCardLT({
    item,
    operatorName,
    nights,
    onCreate,
    children,
}: {
    item: OperatorRoom;
    operatorName: string;
    nights?: number;
    onCreate: () => void;
    /** Карточки наших Room Type под номером. */
    children?: ReactNode;
}) {
    const room = item.room || ({} as OperatorRoom['room']);
    const offers = [...(item.offers || [])].sort((a, b) => Number(a.price) - Number(b.price));
    const meals = [...new Set(offers.map((o) => o.meal))];
    const min = offers.length ? Number(offers[0].price) : null;
    const photo = room.images?.[0]?.x900 || room.images?.[0]?.x900x380 || '';

    return (
        <div style={{ display: 'grid', gap: 8 }}>
            <div style={{ ...cardStyle, padding: 16, display: 'flex', alignItems: 'center', gap: 16 }}>
                <Thumb src={photo} width={160} height={110} />
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                        <span style={{ ...text.cardTitle, fontSize: 17 }}>{room.name_ru || room.name_en || `Номер #${item.room_id}`}</span>
                        <span style={badge('neutral')}>Level.Travel · {operatorName}</span>
                    </div>
                    <div style={{ ...text.body, marginTop: 4 }}>{roomMeta(room, meals) || '—'}</div>
                    <div style={{ ...text.caption, marginTop: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        Предложения: {offers.length ? offers.map((o) => `${o.meal} ${formatMoney(Number(o.price))}`).join(' · ') : 'нет'}
                    </div>
                </div>
                <div style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <div style={{ fontSize: 18, fontWeight: 700, color: t.textPrimary }}>{formatMoney(min)}</div>
                    <div style={text.caption}>Цена Level.Travel{nights ? ` · за ${nights} ${plural(nights, 'ночь', 'ночи', 'ночей')}` : ''}</div>
                </div>
                <button type="button" onClick={onCreate} style={{ ...button('secondary', 'md'), borderRadius: radius.pill, background: t.accentSoft, color: t.accent, border: '1px solid transparent' }}>
                    <Icon name="plus" size={16} />
                    Создать Room Type
                </button>
            </div>
            {children ? <div style={{ display: 'grid', gap: 8, paddingLeft: 56 }}>{children}</div> : null}
        </div>
    );
}
