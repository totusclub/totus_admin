'use client';

// Редактор Room Type одной страницей: якоря Источник / Контент / Цена / История правок,
// справа live-preview; действия «Сохранить» (PUT), «Дублировать», «Сбросить контент к оригиналу», «Удалить».
// v2: режим цены fixed/rule, название оператора; ограничение операторов-шаблонов можно снять, питание — сузить.
// §2.3: блок «Продажи» в разделе «Цена» — «продавать только наши предложения» (скрыть Level.Travel).

import { useEffect, useMemo, useState } from 'react';
import { t, radius, text, cardStyle, button, badge } from '@/lib/theme';
import { ErrorBox, SuccessBox, StatusBadge } from '@/components/notifications/shared';
import {
    updateRoomType, deleteRoomType, getChangeLog, contentFromLtRoom, ltRoomImages, formatMoney, templateOffers,
    type ChangeLogItem, type LtOffer, type RoomSettings, type RoomType, type RoomTypeContent,
} from '@/lib/rooms-api';
import ContentForm from './ContentForm';
import RuleForm, { DEFAULT_OPERATOR_NAME, EXCLUSIVE_WARNING, pricingFromState, pricingBodyFromState, stateFromRoomType, validateRuleState, type RuleFormState } from './RuleForm';
import PricePreview from './PricePreview';
import DuplicateDialog from './DuplicateDialog';
import { ChangeLogList } from './PriceHistory';
import { roomMeta } from './RoomCardLT';
import { STATUS_META, roomTypeStatus, Chip, Stars, ConfirmDialog, ExclusiveBadge, formatDateTime, mealLabel } from './shared';

const SECTIONS = [
    { id: 'source', label: 'Источник' },
    { id: 'content', label: 'Контент' },
    { id: 'price', label: 'Цена' },
    { id: 'changes', label: 'История правок' },
];

export default function RoomTypeEditor({
    roomType,
    settings,
    offers,
    nights,
    searchSummary,
    onSaved,
    onDeleted,
    onDuplicated,
}: {
    roomType: RoomType;
    settings: RoomSettings | null;
    /** Актуальные предложения номера-источника (все операторы), если редактор открыт из выдачи. */
    offers?: LtOffer[];
    nights?: number;
    searchSummary?: string;
    onSaved: (rt: RoomType) => void;
    onDeleted: () => void;
    onDuplicated: (copy: RoomType, openEditor: boolean) => void;
}) {
    const [content, setContent] = useState<RoomTypeContent>(roomType.content);
    const [rule, setRule] = useState<RuleFormState>(() => stateFromRoomType(roomType, settings));
    const [mealTypes, setMealTypes] = useState<string[] | null>(roomType.mealTypes);
    // v2/v3: операторы-шаблоны (чьи предложения берутся шаблоном нашей цены) — можно снять ограничение (пусто = не ограничивать).
    const [operatorIds, setOperatorIds] = useState<number[]>((roomType.operatorIds || []).map(Number));
    const [changes, setChanges] = useState<ChangeLogItem[]>([]);
    const [changesLoading, setChangesLoading] = useState(true);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [done, setDone] = useState<string | null>(null);
    const [duplicate, setDuplicate] = useState(false);
    const [removing, setRemoving] = useState(false);

    useEffect(() => {
        setContent(roomType.content);
        setRule(stateFromRoomType(roomType, settings));
        setMealTypes(roomType.mealTypes);
        setOperatorIds((roomType.operatorIds || []).map(Number));
    }, [roomType, settings]);

    useEffect(() => {
        setChangesLoading(true);
        getChangeLog(roomType.id, 100)
            .then(setChanges)
            .catch(() => setChanges([]))
            .finally(() => setChangesLoading(false));
    }, [roomType.id]);

    const ltImages = useMemo(() => ltRoomImages(roomType.sourceSnapshot), [roomType.sourceSnapshot]);
    const pricing = pricingFromState(rule);
    const ourOperator = rule.operatorName.trim() || DEFAULT_OPERATOR_NAME;

    // Предложения для preview: шаблоны из актуальной выдачи (самое дешёвое по питанию, оператор не важен),
    // иначе последняя виденная цена.
    const sourceOffers = useMemo(() => offers || [], [offers]);
    const knownMeals = useMemo(() => [...new Set([...(sourceOffers.map((o) => o.meal)), ...(roomType.mealTypes || [])])], [sourceOffers, roomType.mealTypes]);
    const previewOffers = useMemo(() => {
        const list = templateOffers(sourceOffers, mealTypes).map((o) => ({ operator_name: o.operator_name, meal: o.meal, price: Number(o.price), nights_count: o.nights_count || nights || null }));
        if (list.length) return list;
        if (roomType.last?.providerPrice) return [{ operator_name: roomType.last.operator, meal: null, price: roomType.last.providerPrice, nights_count: nights || null }];
        return [];
    }, [sourceOffers, mealTypes, roomType.last, nights]);

    const toggleMeal = (meal: string) => {
        const current = mealTypes || knownMeals;
        const next = current.includes(meal) ? current.filter((m) => m !== meal) : [...current, meal];
        if (!next.length) {
            setMealTypes(null);
            return;
        }
        setMealTypes(knownMeals.length && next.length >= knownMeals.length && knownMeals.every((m) => next.includes(m)) ? null : next);
    };

    const save = async () => {
        setError(null);
        setDone(null);
        if (!content.nameRu.trim()) {
            setError('Укажите название Room Type');
            return;
        }
        const problem = validateRuleState(rule);
        if (problem || !pricing) {
            setError(problem || 'Проверьте цену');
            return;
        }
        setBusy(true);
        try {
            const body = pricingBodyFromState(rule);
            const next = await updateRoomType(roomType.id, {
                operatorIds,
                operatorNames: operatorIds.length ? roomType.operatorNames : [],
                mealTypes,
                content: { ...content, nameRu: content.nameRu.trim() },
                pricingMode: body.pricingMode,
                fixedPrice: body.fixedPrice,
                fixedPriceUnit: body.fixedPriceUnit,
                operatorName: body.operatorName,
                rule: body.rule || undefined,
                packageTypes: body.packageTypes,
                exclusive: body.exclusive,
                exclusiveScope: body.exclusiveScope,
                badge: rule.badge.trim() || settings?.badge || 'Totus',
                active: rule.active,
            });
            setDone('Изменения сохранены');
            onSaved(next);
            getChangeLog(roomType.id, 100).then(setChanges).catch(() => undefined);
        } catch (e: any) {
            setError(e?.message || 'Не удалось сохранить');
        } finally {
            setBusy(false);
        }
    };

    const resetContent = () => {
        if (!roomType.sourceSnapshot) {
            setError('Слепок исходного номера не сохранён — сбросить нечего');
            return;
        }
        setContent(contentFromLtRoom(roomType.sourceSnapshot));
        setDone('Контент заменён на исходный Level.Travel — не забудьте сохранить');
    };

    const remove = async () => {
        setBusy(true);
        try {
            await deleteRoomType(roomType.id);
            onDeleted();
        } catch (e: any) {
            setError(e?.message || 'Не удалось удалить');
            setBusy(false);
            setRemoving(false);
        }
    };

    const scrollTo = (id: string) => document.getElementById(`rt-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    const status = roomTypeStatus(roomType);
    const st = STATUS_META[status];
    const snapshotName = String(roomType.sourceSnapshot?.name_ru || roomType.sourceRoomName || `#${roomType.sourceRoomId}`);

    return (
        <div style={{ display: 'grid', gap: 16 }}>
            <div style={{ ...cardStyle, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {SECTIONS.map((s) => (
                        <button key={s.id} type="button" onClick={() => scrollTo(s.id)} style={{ ...button('tertiary', 'sm'), borderRadius: radius.pill }}>{s.label}</button>
                    ))}
                </div>
                <div style={{ flex: 1 }} />
                <button type="button" onClick={() => setDuplicate(true)} disabled={busy} style={button('secondary', 'md')}>Дублировать</button>
                <button type="button" onClick={resetContent} disabled={busy} style={button('secondary', 'md')}>Сбросить контент к оригиналу</button>
                <button type="button" onClick={() => setRemoving(true)} disabled={busy} style={{ ...button('tertiary', 'md'), color: t.error }}>Удалить</button>
                <button type="button" onClick={save} disabled={busy} style={{ ...button('primary', 'md'), opacity: busy ? 0.6 : 1 }}>{busy ? 'Сохраняем...' : 'Сохранить'}</button>
            </div>

            <ErrorBox message={error} />
            <SuccessBox message={done} />

            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.4fr) minmax(320px, 1fr)', gap: 20, alignItems: 'start' }}>
                <div style={{ display: 'grid', gap: 16 }}>
                    <section id="rt-source" style={{ ...cardStyle, scrollMarginTop: 16 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
                            <h2 style={{ ...text.sectionTitle, margin: 0 }}>Источник</h2>
                            <StatusBadge label={st.label} tone={st.tone} />
                            <ExclusiveBadge rt={roomType} />
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr', rowGap: 8, columnGap: 12, fontSize: 14 }}>
                            <span style={{ color: t.textTertiary }}>Отель</span>
                            <span style={{ display: 'flex', gap: 8, alignItems: 'center', color: t.textPrimary }}>
                                {roomType.hotelName || `#${roomType.hotelId}`} <Stars count={roomType.hotelStars || 0} size={12} /> {roomType.hotelCity ? <span style={text.caption}>· {roomType.hotelCity}</span> : null}
                            </span>
                            <span style={{ color: t.textTertiary }}>Номер Level.Travel</span>
                            <span style={{ color: t.textPrimary }}>
                                {snapshotName} <span style={text.caption}>· id {roomType.sourceRoomId}{roomType.sourceSnapshot ? ` · ${roomMeta(roomType.sourceSnapshot)}` : ''}</span>
                            </span>
                            <span style={{ color: t.textTertiary }}>Наш оператор</span>
                            <span style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                                <span style={badge('accent')}>{ourOperator}</span>
                                <span style={text.caption}>наше предложение показывается внутри номера рядом с предложениями Level.Travel при любых датах и составе гостей · название меняется в разделе «Цена»</span>
                            </span>
                            <span style={{ color: t.textTertiary }}>Продажи</span>
                            <span style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                                {rule.exclusive ? (
                                    <>
                                        <span style={badge('warning')}>{rule.exclusiveScope === 'hotel' ? 'Только наши · весь отель' : 'Только наши'}</span>
                                        <span style={text.caption}>{EXCLUSIVE_WARNING}</span>
                                    </>
                                ) : (
                                    <span style={text.body}>продаются и наши предложения, и Level.Travel — переключается в разделе «Цена», блок «Продажи»</span>
                                )}
                            </span>
                            <span style={{ color: t.textTertiary }}>Операторы-шаблоны</span>
                            <span style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                                {operatorIds.length ? (
                                    <>
                                        {(roomType.operatorNames?.length ? roomType.operatorNames : operatorIds.map(String)).map((name) => (
                                            <span key={name} style={badge('info')}>{name}</span>
                                        ))}
                                        <span style={text.caption}>— шаблоном цены {ourOperator} берутся предложения только этих операторов; предложения Level.Travel у номера остаются</span>
                                        <button type="button" onClick={() => setOperatorIds([])} style={button('tertiary', 'sm')}>не ограничивать</button>
                                    </>
                                ) : (
                                    <span style={text.body}>не ограничено — шаблон берётся из самого дешёвого предложения номера; предложения Level.Travel остаются</span>
                                )}
                            </span>
                            <span style={{ color: t.textTertiary }}>Питание</span>
                            <span style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                                {knownMeals.length ? (
                                    knownMeals.map((m) => (
                                        <Chip key={m} active={!mealTypes || mealTypes.includes(m)} onClick={() => toggleMeal(m)} title={mealLabel(m)}>{m}</Chip>
                                    ))
                                ) : (
                                    <span style={text.body}>самое дешёвое питание номера</span>
                                )}
                                {mealTypes ? <button type="button" onClick={() => setMealTypes(null)} style={button('tertiary', 'sm')}>все</button> : null}
                            </span>
                            <span style={{ color: t.textTertiary }}>Последний показ</span>
                            <span style={{ color: t.textPrimary }}>
                                {roomType.last?.seenAt
                                    ? `${formatDateTime(roomType.last.seenAt)} · ${roomType.last.operator || ''} · ${formatMoney(roomType.last.providerPrice)} → ${formatMoney(roomType.last.finalPrice)}`
                                    : 'ещё не показывался на витрине'}
                            </span>
                            <span style={{ color: t.textTertiary }}>Заказов</span>
                            <span style={{ color: t.textPrimary }}>{roomType.ordersCount ?? 0}</span>
                        </div>
                    </section>

                    <section id="rt-content" style={{ ...cardStyle, scrollMarginTop: 16 }}>
                        <h2 style={{ ...text.sectionTitle, margin: '0 0 14px' }}>Контент</h2>
                        <ContentForm value={content} onChange={setContent} ltImages={ltImages} />
                    </section>

                    <section id="rt-price" style={{ scrollMarginTop: 16 }}>
                        <h2 style={{ ...text.sectionTitle, margin: '0 0 12px' }}>Цена</h2>
                        <RuleForm value={rule} onChange={setRule} settings={settings} />
                    </section>

                    <section id="rt-changes" style={{ ...cardStyle, scrollMarginTop: 16 }}>
                        <h2 style={{ ...text.sectionTitle, margin: '0 0 8px' }}>История правок</h2>
                        <ChangeLogList items={changes} loading={changesLoading} />
                    </section>
                </div>

                <div style={{ position: 'sticky', top: 16 }}>
                    <PricePreview
                        pricing={pricing}
                        offers={previewOffers}
                        settings={settings}
                        subtitle={sourceOffers.length ? searchSummary : roomType.last?.seenAt ? `по последней виденной цене · ${formatDateTime(roomType.last.seenAt)}` : undefined}
                        nights={nights}
                        userCard={{ name: content.nameRu, meta: roomMeta({ ...(roomType.sourceSnapshot || {}), id: roomType.sourceRoomId, area: content.area ?? undefined, view: content.view ?? undefined, accommodation: content.accommodation ?? undefined }), photo: content.images[0]?.url, sourceName: snapshotName, operator: ourOperator }}
                    />
                </div>
            </div>

            {duplicate ? (
                <DuplicateDialog
                    roomType={roomType}
                    onClose={() => setDuplicate(false)}
                    onDone={(copy, openEditor) => {
                        setDuplicate(false);
                        onDuplicated(copy, openEditor);
                    }}
                />
            ) : null}

            {removing ? (
                <ConfirmDialog
                    title="Удалить Room Type?"
                    message={<>«{roomType.content?.nameRu}» исчезнет с витрины, история цен и правок будет удалена. Заказы не затрагиваются.</>}
                    busy={busy}
                    onConfirm={remove}
                    onClose={() => setRemoving(false)}
                />
            ) : null}
        </div>
    );
}
