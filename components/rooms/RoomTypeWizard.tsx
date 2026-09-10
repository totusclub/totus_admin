'use client';

// Мастер «Новый Room Type на основе номера» (модал поверх страницы отеля, 3 шага):
// 1) источник — предложения номера (оператор × питание) с чекбоксами → operatorIds / mealTypes;
// 2) контент — предзаполнен из LT, фото LT или свои; 3) цена — правило + live-preview → POST /room-types.

import { useMemo, useState } from 'react';
import Icon from '@/components/Icon';
import { t, radius, text, cardStyle, button, badge } from '@/lib/theme';
import { Modal, ErrorBox } from '@/components/notifications/shared';
import { createRoomType, contentFromLtRoom, ltRoomImages, formatMoney, type LtOffer, type LtRoom, type RoomSettings, type RoomType, type RoomTypeContent } from '@/lib/rooms-api';
import ContentForm from './ContentForm';
import RuleForm, { defaultRuleState, ruleFromState, validateRuleState, type RuleFormState } from './RuleForm';
import PricePreview from './PricePreview';
import { roomMeta } from './RoomCardLT';
import { Thumb, Stars, mealLabel, tableStyle, thStyle, tdStyle, tdRight, thRight, TableWrap } from './shared';

export interface WizardHotel {
    id: number;
    name: string;
    stars: number;
    city: string;
}

const STEPS = ['Источник', 'Контент', 'Цена'];

function Stepper({ step }: { step: number }) {
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
            {STEPS.map((label, i) => {
                const n = i + 1;
                const done = n < step;
                const active = n === step;
                return (
                    <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span
                                style={{
                                    width: 24,
                                    height: 24,
                                    borderRadius: radius.pill,
                                    background: done || active ? t.accent : t.surfaceInset,
                                    color: done || active ? t.textOnAccent : t.textTertiary,
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: 12,
                                    fontWeight: 700,
                                }}
                            >
                                {done ? <Icon name="check" size={14} /> : n}
                            </span>
                            <span style={{ fontSize: 14, fontWeight: active ? 600 : 500, color: active ? t.textPrimary : t.textSecondary }}>{label}</span>
                        </div>
                        {i < STEPS.length - 1 ? <span style={{ width: 48, height: 1, background: t.border }} /> : null}
                    </div>
                );
            })}
        </div>
    );
}

export default function RoomTypeWizard({
    hotel,
    room,
    offers,
    operatorId,
    operatorName,
    settings,
    nights,
    searchSummary,
    onClose,
    onCreated,
}: {
    hotel: WizardHotel;
    room: LtRoom;
    /** Все предложения номера (все операторы) из GET /hotels/:id/rooms → rooms[].offers. */
    offers: LtOffer[];
    /** Оператор, из группы которого открыт мастер — его предложения выбраны по умолчанию. */
    operatorId: number;
    operatorName: string;
    settings: RoomSettings | null;
    nights?: number;
    searchSummary?: string;
    onClose: () => void;
    onCreated: (rt: RoomType) => void;
}) {
    const [step, setStep] = useState(1);
    const [selected, setSelected] = useState<Set<string>>(() => new Set(offers.filter((o) => Number(o.operator_id) === Number(operatorId)).map((o) => o.id)));
    const ltImages = useMemo(() => ltRoomImages(room), [room]);
    // Название предзаполняется именем исходного номера (name_ru) — на витрине наши комнаты не помечаются.
    const [content, setContent] = useState<RoomTypeContent>(() => contentFromLtRoom(room));
    const [rule, setRule] = useState<RuleFormState>(() => defaultRuleState(settings));
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);

    const sortedOffers = useMemo(() => [...offers].sort((a, b) => a.operator_name.localeCompare(b.operator_name) || a.price - b.price), [offers]);
    const chosen = sortedOffers.filter((o) => selected.has(o.id));
    const operatorIds = [...new Set(chosen.map((o) => Number(o.operator_id)))];
    const operatorNames = [...new Set(chosen.map((o) => o.operator_name))];
    const allMeals = [...new Set(offers.map((o) => o.meal))];
    const chosenMeals = [...new Set(chosen.map((o) => o.meal))];
    const mealTypes = chosenMeals.length && chosenMeals.length < allMeals.length ? chosenMeals : null;
    const ruleInput = ruleFromState(rule);

    const toggle = (id: string) => {
        const next = new Set(selected);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setSelected(next);
    };

    const next = () => {
        setError(null);
        if (step === 1 && !chosen.length) {
            setError('Выберите хотя бы одно предложение — вместо него будет показан наш Room Type');
            return;
        }
        if (step === 2 && !content.nameRu.trim()) {
            setError('Укажите название Room Type');
            return;
        }
        setStep((s) => Math.min(3, s + 1));
    };

    const submit = async () => {
        setError(null);
        const problem = validateRuleState(rule);
        if (problem || !ruleInput) {
            setError(problem || 'Проверьте правило цены');
            return;
        }
        setBusy(true);
        try {
            const rt = await createRoomType({
                hotelId: hotel.id,
                hotelName: hotel.name,
                hotelStars: hotel.stars || null,
                hotelCity: hotel.city || null,
                sourceRoomId: Number(room.id),
                sourceRoomName: String(room.name_ru || room.name_en || ''),
                sourceSnapshot: room,
                operatorIds,
                operatorNames,
                mealTypes,
                content: { ...content, nameRu: content.nameRu.trim() },
                rule: ruleInput,
                packageTypes: ['hotel'],
                badge: rule.badge.trim() || settings?.badge || 'Totus',
                active: rule.active,
            });
            onCreated(rt);
        } catch (e: any) {
            setError(e?.message || 'Не удалось создать Room Type');
            setBusy(false);
        }
    };

    const roomName = String(room.name_ru || room.name_en || `Номер #${room.id}`);
    const photo = ltImages[0]?.url;

    // Клик по оверлею / Esc после первого шага — спрашиваем, чтобы не потерять введённое.
    const close = () => {
        if (busy) return;
        if (step === 1 || window.confirm('Закрыть мастер? Введённые данные будут потеряны.')) onClose();
    };

    return (
        <Modal title="Новый Room Type на основе номера" onClose={close} width={1120}>
            <div style={{ ...text.caption, marginTop: -12, marginBottom: 16 }}>
                {hotel.name} · {roomName} · {operatorName}
            </div>
            <Stepper step={step} />

            {step === 1 ? (
                <div style={{ display: 'grid', gap: 16 }}>
                    <div style={{ ...cardStyle, padding: 16, display: 'flex', gap: 16, alignItems: 'center' }}>
                        <Thumb src={photo} width={120} height={84} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                <span style={text.cardTitle}>{roomName}</span>
                                <span style={badge('neutral')}>Level.Travel · {operatorName}</span>
                            </div>
                            <div style={{ ...text.body, marginTop: 4 }}>{roomMeta(room, allMeals) || '—'}</div>
                            <div style={{ ...text.caption, marginTop: 4, display: 'flex', gap: 8, alignItems: 'center' }}>
                                {hotel.name} <Stars count={hotel.stars} size={11} /> {hotel.city ? `· ${hotel.city}` : ''}{searchSummary ? ` · ${searchSummary}` : ''}
                            </div>
                        </div>
                    </div>

                    <div>
                        <div style={{ ...text.cardTitle, marginBottom: 8 }}>Предложения источника</div>
                        <TableWrap>
                            <table style={tableStyle}>
                                <thead>
                                    <tr>
                                        <th style={{ ...thStyle, width: 40 }} />
                                        <th style={thStyle}>Оператор</th>
                                        <th style={thStyle}>Питание</th>
                                        <th style={thRight}>Ночей</th>
                                        <th style={thRight}>Цена LT</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {sortedOffers.map((o) => {
                                        const on = selected.has(o.id);
                                        return (
                                            <tr key={o.id} onClick={() => toggle(o.id)} style={{ cursor: 'pointer', background: on ? t.accentSoft : undefined }}>
                                                <td style={tdStyle}><input type="checkbox" checked={on} onChange={() => toggle(o.id)} onClick={(e) => e.stopPropagation()} /></td>
                                                <td style={{ ...tdStyle, fontWeight: 600 }}>{o.operator_name}</td>
                                                <td style={tdStyle}>{mealLabel(o.meal)}</td>
                                                <td style={tdRight}>{o.nights_count || nights || '—'}</td>
                                                <td style={{ ...tdRight, fontWeight: 600 }}>{formatMoney(Number(o.price))}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </TableWrap>
                        <div style={{ ...text.caption, marginTop: 8 }}>
                            Наш Room Type будет показан вместо выбранных предложений. Остальные предложения этого номера и другие номера остаются как есть.
                            {chosen.length ? ` Выбрано: ${chosen.length} · операторы: ${operatorNames.join(', ')} · питание: ${mealTypes ? mealTypes.join(', ') : 'все'}.` : ''}
                        </div>
                    </div>
                </div>
            ) : null}

            {step === 2 ? <ContentForm value={content} onChange={setContent} ltImages={ltImages} /> : null}

            {step === 3 ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1.2fr)', gap: 20 }}>
                    <RuleForm value={rule} onChange={setRule} settings={settings} />
                    <PricePreview
                        rule={ruleInput}
                        offers={chosen.map((o) => ({ operator_name: o.operator_name, meal: o.meal, price: Number(o.price) }))}
                        settings={settings}
                        subtitle={searchSummary}
                        nights={nights}
                        userCard={{ name: content.nameRu, meta: roomMeta(room, chosenMeals), photo: content.images[0]?.url, sourceName: roomName, operator: operatorNames.join(', ') }}
                    />
                </div>
            ) : null}

            <div style={{ marginTop: 16 }}>
                <ErrorBox message={error} />
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginTop: 16, paddingTop: 16, borderTop: `1px solid ${t.border}` }}>
                <div>
                    {step > 1 ? (
                        <button type="button" onClick={() => setStep((s) => s - 1)} disabled={busy} style={button('secondary', 'md')}>Назад</button>
                    ) : null}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                    <button type="button" onClick={close} disabled={busy} style={button('secondary', 'md')}>Отмена</button>
                    {step < 3 ? (
                        <button type="button" onClick={next} style={button('primary', 'md')}>Далее</button>
                    ) : (
                        <button type="button" onClick={submit} disabled={busy} style={{ ...button('primary', 'md'), opacity: busy ? 0.6 : 1 }}>
                            {busy ? 'Создаём...' : 'Создать Room Type'}
                        </button>
                    )}
                </div>
            </div>
        </Modal>
    );
}
