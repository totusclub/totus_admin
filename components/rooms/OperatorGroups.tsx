'use client';

// Вкладка «Номера Level.Travel»: группы по оператору → номера LT → наши Room Type под номером.
// v2: наши Room Type видны под номером всегда (rooms[].room_types / operators[].rooms[].room_types из ответа),
// даже если предложения оператора Arlekino у LT нет.
// v3: на витрине отдельной карточки нет — наше предложение внутри номера рядом с предложениями Level.Travel; здесь как есть.
// §2.3: если у отеля включён флаг «только наши предложения» — строка над списком и пометка «Level.Travel скрыт» у закрытых номеров.

import { useState, type ReactNode } from 'react';
import Icon from '@/components/Icon';
import { t, radius, text, badge } from '@/lib/theme';
import { isRoomExclusive, type HotelRoomsResult, type OperatorGroup, type OperatorRoom, type RoomType } from '@/lib/rooms-api';
import RoomCardLT from './RoomCardLT';
import RoomTypeCard from './RoomTypeCard';
import { Empty, plural } from './shared';

/**
 * Наши Room Type под номером: по `room_types` номера из ответа (v2: сервер отдаёт их всегда, когда номер в выдаче;
 * в группе оператора — без ограничения операторов или с этим оператором). Fallback — по sourceRoomId.
 */
export function roomTypesFor(result: HotelRoomsResult, room: OperatorRoom, operatorId: number): RoomType[] {
    const all = result.room_types || [];
    const ids = Array.isArray(room.room_types) && room.room_types.length
        ? room.room_types.map(Number)
        : ((result.rooms || []).find((r) => Number(r.room?.id) === Number(room.room_id))?.room_types || []).map(Number);
    if (ids.length) return all.filter((rt) => ids.includes(Number(rt.id)));
    return all.filter((rt) => Number(rt.sourceRoomId) === Number(room.room_id) && (!(rt.operatorIds || []).length || (rt.operatorIds || []).map(Number).includes(Number(operatorId))));
}

/** §2.3: закрыт ли номер для Level.Travel — по флагу самого номера, иначе по сводке `exclusive` отеля. */
export function roomExclusive(result: HotelRoomsResult, room: OperatorRoom): boolean {
    if (room.exclusive) return true;
    const byRooms = (result.rooms || []).find((r) => Number(r.room?.id) === Number(room.room_id));
    if (byRooms?.exclusive) return true;
    return isRoomExclusive(result.exclusive, room.room_id);
}

function GroupHeader({ group, open, onToggle }: { group: OperatorGroup; open: boolean; onToggle: () => void }) {
    const n = group.rooms.length;
    return (
        <button
            type="button"
            onClick={onToggle}
            aria-expanded={open}
            style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                width: '100%',
                padding: '10px 14px',
                borderRadius: radius.md,
                border: `1px solid ${t.border}`,
                background: t.surfaceInset,
                cursor: 'pointer',
                textAlign: 'left',
                fontFamily: 'inherit',
            }}
        >
            <span aria-hidden style={{ width: 28, height: 28, borderRadius: radius.sm, background: t.info, color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 13 }}>
                {(group.operator_name || '?').slice(0, 1).toUpperCase()}
            </span>
            <span style={{ ...text.cardTitle, fontSize: 15 }}>Оператор {group.operator_name || `#${group.operator_id}`} · {n} {plural(n, 'номер', 'номера', 'номеров')}</span>
            <span style={badge('neutral')}>Level.Travel</span>
            <span style={{ flex: 1 }} />
            <Icon name="chevronDown" size={18} style={{ color: t.textTertiary, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
        </button>
    );
}

export default function OperatorGroups({
    result,
    nights,
    busyId,
    onCreate,
    onEdit,
    onDuplicate,
    onToggle,
}: {
    result: HotelRoomsResult;
    nights?: number;
    busyId?: number | null;
    onCreate: (room: OperatorRoom, group: OperatorGroup) => void;
    onEdit: (rt: RoomType) => void;
    onDuplicate: (rt: RoomType) => void;
    onToggle: (rt: RoomType, active: boolean) => void;
}) {
    const groups = result.operators || [];
    const [collapsed, setCollapsed] = useState<Set<number>>(() => new Set(groups.slice(1).map((g) => g.operator_id)));
    const hotelExclusive = result.exclusive?.active === true;

    if (!groups.length) {
        return <Empty title="Level.Travel не вернул номера на эти даты" hint="Попробуйте другие даты или проверьте, что поиск ещё не устарел (выдача живёт ~2 часа)" />;
    }

    const toggleGroup = (id: number) => {
        const next = new Set(collapsed);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setCollapsed(next);
    };

    return (
        <div style={{ display: 'grid', gap: 12 }}>
            {hotelExclusive ? (
                <div style={{ padding: '10px 12px', borderRadius: radius.sm, background: t.warningSoft, color: t.textPrimary, fontSize: 13, lineHeight: '18px', display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                    <Icon name="info" size={16} style={{ marginTop: 1, flexShrink: 0 }} />
                    <span>
                        В этом отеле продаются только наши предложения (Level.Travel скрыт)
                        {result.exclusive?.scope === 'hotel'
                            ? ' — во всех номерах отеля.'
                            : ` — в номерах: ${(result.exclusive?.rooms || []).join(', ') || '—'}.`}
                    </span>
                </div>
            ) : null}
            {groups.map((group) => {
                const open = !collapsed.has(group.operator_id);
                return (
                    <div key={group.operator_id} style={{ display: 'grid', gap: 12 }}>
                        <GroupHeader group={group} open={open} onToggle={() => toggleGroup(group.operator_id)} />
                        {open
                            ? group.rooms.map((room) => {
                                  const ours = roomTypesFor(result, room, group.operator_id);
                                  const closed = roomExclusive(result, room);
                                  const children: ReactNode = closed || ours.length ? (
                                      <>
                                          {closed ? (
                                              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                                  <span style={badge('warning')}>Level.Travel скрыт</span>
                                                  <span style={text.caption}>предложения Level.Travel в этом номере не показываются и не бронируются</span>
                                              </div>
                                          ) : null}
                                          {ours.map((rt) => (
                                              <RoomTypeCard key={rt.id} rt={rt} busy={busyId === rt.id} onEdit={() => onEdit(rt)} onDuplicate={() => onDuplicate(rt)} onToggle={(active) => onToggle(rt, active)} />
                                          ))}
                                      </>
                                  ) : null;
                                  return (
                                      <RoomCardLT key={`${group.operator_id}-${room.room_id}`} item={room} operatorName={group.operator_name} nights={nights} onCreate={() => onCreate(room, group)}>
                                          {children}
                                      </RoomCardLT>
                                  );
                              })
                            : null}
                    </div>
                );
            })}
        </div>
    );
}
