'use client';

// Мастер «Новый Room Type на основе номера» (модал поверх страницы отеля, 3 шага). v2:
// 1) источник — выбранный номер Level.Travel (карточка; обязателен), необязательный сворачиваемый блок
//    «Ограничить операторов/питание» (по умолчанию пусто = не ограничивать: наше предложение показывается внутри номера
//    рядом с предложениями Level.Travel при любых датах и составе гостей); 2) контент — предзаполнен из LT, фото LT или свои;
// 3) цена — «Фиксированная цена Arlekino» (по умолчанию) ⟷ «Правило от цены Level.Travel» + live-preview → POST /room-types.

import { useMemo, useState } from 'react';
import Icon from '@/components/Icon';
import { t, radius, text, cardStyle, button, badge } from '@/lib/theme';
import { Modal, ErrorBox } from '@/components/notifications/shared';
import { createRoomType, contentFromLtRoom, ltRoomImages, formatMoney, templateOffers, type LtOffer, type LtRoom, type RoomSettings, type RoomType, type RoomTypeContent } from '@/lib/rooms-api';
import ContentForm from './ContentForm';
import RuleForm, { DEFAULT_OPERATOR_NAME, defaultRuleState, pricingFromState, pricingBodyFromState, validateRuleState, type RuleFormState } from './RuleForm';
import PricePreview from './PricePreview';
import { roomMeta } from './RoomCardLT';
import { Thumb, Stars, mealLabel, tableStyle, thStyle, tdStyle, tdRight, thRight, TableWrap } from './shared';

export interface WizardHotel {
    id: number;
    name: string;
    stars: number;
    city: string;
}

const STEPS = ['Номер', 'Контент', 'Цена'];

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
    /** Выбранный номер Level.Travel (обязателен) — из карточки, у которой нажали «Создать Room Type». */
    room: LtRoom;
    /** Все предложения номера (все операторы) из GET /hotels/:id/rooms → rooms[].offers. */
    offers: LtOffer[];
    /** Оператор, из группы которого открыт мастер — только для подписи; ограничение по умолчанию не ставится. */
    operatorId?: number;
    operatorName?: string;
    settings: RoomSettings | null;
    nights?: number;
    searchSummary?: string;
    onClose: () => void;
    onCreated: (rt: RoomType) => void;
}) {
    const [step, setStep] = useState(1);
    // v2: ограничение операторов/питания необязательно — по умолчанию ничего не выбрано (= не ограничивать).
    const [restrict, setRestrict] = useState(false);
    const [selected, setSelected] = useState<Set<string>>(() => new Set());
    const ltImages = useMemo(() => ltRoomImages(room), [room]);
    // Название предзаполняется именем исходного номера (name_ru) — v3: на витрине карточка номера одна (LT), контент Room Type остаётся для админки.
    const [content, setContent] = useState<RoomTypeContent>(() => contentFromLtRoom(room));
    const [rule, setRule] = useState<RuleFormState>(() => defaultRuleState(settings));
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);

    const sortedOffers = useMemo(() => [...offers].sort((a, b) => a.operator_name.localeCompare(b.operator_name) || a.price - b.price), [offers]);
    const chosen = restrict ? sortedOffers.filter((o) => selected.has(o.id)) : [];
    const operatorIds = [...new Set(chosen.map((o) => Number(o.operator_id)))];
    const operatorNames = [...new Set(chosen.map((o) => o.operator_name))];
    const allMeals = [...new Set(offers.map((o) => o.meal))];
    const chosenMeals = [...new Set(chosen.map((o) => o.meal))];
    const mealTypes = chosenMeals.length && chosenMeals.length < allMeals.length ? chosenMeals : null;
    const pricing = pricingFromState(rule);
    const ourOperator = rule.operatorName.trim() || DEFAULT_OPERATOR_NAME;
    // Шаблоны, как их выберет витрина: самое дешёвое предложение номера (по питанию, если ограничено).
    const templates = useMemo(() => templateOffers(offers, mealTypes), [offers, mealTypes]);

    const toggle = (id: string) => {
        const next = new Set(selected);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setSelected(next);
    };

    const next = () => {
        setError(null);
        if (step === 1 && !room?.id) {
            setError('Не выбран номер Level.Travel');
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
        if (problem || !pricing) {
            setError(problem || 'Проверьте цену');
            return;
        }
        setBusy(true);
        try {
            const body = pricingBodyFromState(rule);
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
                pricingMode: body.pricingMode,
                fixedPrice: body.fixedPrice,
                fixedPriceUnit: body.fixedPriceUnit,
                operatorName: body.operatorName,
                rule: body.rule || undefined,
                packageTypes: body.packageTypes,
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
    const minOffer = sortedOffers.length ? [...sortedOffers].sort((a, b) => a.price - b.price)[0] : null;

    // Клик по оверлею / Esc после первого шага — спрашиваем, чтобы не потерять введённое.
    const close = () => {
        if (busy) return;
        if (step === 1 || window.confirm('Закрыть мастер? Введённые данные будут потеряны.')) onClose();
    };

    return (
        <Modal title="Новый Room Type на основе номера" onClose={close} width={1120}>
            <div style={{ ...text.caption, marginTop: -12, marginBottom: 16 }}>
                {hotel.name} · {roomName}{operatorName ? ` · открыт из группы ${operatorName}` : ''}
            </div>
            <Stepper step={step} />

            {step === 1 ? (
                <div style={{ display: 'grid', gap: 16 }}>
                    <div>
                        <div style={{ ...text.cardTitle, marginBottom: 8 }}>Номер Level.Travel</div>
                        <div style={{ ...cardStyle, padding: 16, display: 'flex', gap: 16, alignItems: 'center', border: `1px solid ${t.accentBorder}` }}>
                            <Thumb src={photo} width={120} height={84} />
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                    <span style={text.cardTitle}>{roomName}</span>
                                    <span style={badge('neutral')}>Level.Travel · id {room.id}</span>
                                    <span style={badge('success')}>Выбран</span>
                                </div>
                                <div style={{ ...text.body, marginTop: 4 }}>{roomMeta(room, allMeals) || '—'}</div>
                                <div style={{ ...text.caption, marginTop: 4, display: 'flex', gap: 8, alignItems: 'center' }}>
                                    {hotel.name} <Stars count={hotel.stars} size={11} /> {hotel.city ? `· ${hotel.city}` : ''}{searchSummary ? ` · ${searchSummary}` : ''}
                                </div>
                            </div>
                            <div style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                                <div style={{ fontSize: 18, fontWeight: 700, color: t.textPrimary }}>{formatMoney(minOffer ? Number(minOffer.price) : null)}</div>
                                <div style={text.caption}>{minOffer ? `самое дешёвое · ${minOffer.operator_name} · ${minOffer.meal}` : 'нет предложений в выдаче'}</div>
                            </div>
                        </div>
                        <div style={{ marginTop: 10, padding: '10px 12px', borderRadius: radius.sm, background: t.accentSoft, color: t.textPrimary, fontSize: 13, lineHeight: '18px', display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                            <Icon name="info" size={16} style={{ marginTop: 1, flexShrink: 0 }} />
                            <span>
                                Наше предложение {ourOperator} показывается внутри этого номера рядом с предложениями Level.Travel при любых датах и составе гостей — предложения Level.Travel не удаляются.
                                Цена задаётся на шаге «Цена»; шаблон предложения — самое дешёвое предложение номера.
                            </span>
                        </div>
                    </div>

                    <div style={{ ...cardStyle, padding: 0, overflow: 'hidden' }}>
                        <button
                            type="button"
                            onClick={() => setRestrict((v) => !v)}
                            aria-expanded={restrict}
                            style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '12px 16px', border: 'none', background: t.surfaceInset, cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit' }}
                        >
                            <Icon name="chevronDown" size={18} style={{ color: t.textTertiary, transform: restrict ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
                            <span style={{ ...text.cardTitle, fontSize: 14 }}>Ограничить операторов/питание</span>
                            <span style={text.caption}>необязательно · {chosen.length ? `выбрано ${chosen.length}` : 'не ограничивать'}</span>
                        </button>
                        {restrict ? (
                            <div style={{ padding: 16, display: 'grid', gap: 10 }}>
                                <div style={text.caption}>
                                    Отметьте предложения, если шаблоном цены {ourOperator} нужно брать предложения только конкретных операторов
                                    или ограничить типы питания. Предложения Level.Travel у номера остаются. Пусто — не ограничивать.
                                </div>
                                {sortedOffers.length ? (
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
                                                            <td style={{ ...tdStyle, fontWeight: 600 }}>{o.operator_name}{operatorId !== undefined && Number(o.operator_id) === Number(operatorId) ? <span style={{ ...text.caption, marginLeft: 6 }}>(из этой группы)</span> : null}</td>
                                                            <td style={tdStyle}>{mealLabel(o.meal)}</td>
                                                            <td style={tdRight}>{o.nights_count || nights || '—'}</td>
                                                            <td style={{ ...tdRight, fontWeight: 600 }}>{formatMoney(Number(o.price))}</td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </TableWrap>
                                ) : (
                                    <div style={text.body}>У номера нет предложений в этой выдаче — ограничить нечего.</div>
                                )}
                                {chosen.length ? (
                                    <div style={{ ...text.caption }}>
                                        Операторы-шаблоны: {operatorNames.join(', ')} · питание: {mealTypes ? mealTypes.join(', ') : 'все'}.
                                        <button type="button" onClick={() => setSelected(new Set())} style={{ ...button('tertiary', 'sm'), marginLeft: 8 }}>Сбросить</button>
                                    </div>
                                ) : null}
                            </div>
                        ) : null}
                    </div>
                </div>
            ) : null}

            {step === 2 ? <ContentForm value={content} onChange={setContent} ltImages={ltImages} /> : null}

            {step === 3 ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1.2fr)', gap: 20 }}>
                    <RuleForm value={rule} onChange={setRule} settings={settings} />
                    <PricePreview
                        pricing={pricing}
                        offers={templates.map((o) => ({ operator_name: o.operator_name, meal: o.meal, price: Number(o.price), nights_count: o.nights_count || nights || null }))}
                        settings={settings}
                        subtitle={searchSummary}
                        nights={nights}
                        userCard={{ name: content.nameRu, meta: roomMeta(room, mealTypes || (templates[0] ? [templates[0].meal] : [])), photo: content.images[0]?.url, sourceName: roomName, operator: ourOperator }}
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
