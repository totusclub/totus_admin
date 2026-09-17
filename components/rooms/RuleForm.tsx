'use client';

// Цена и витрина (шаг 3 мастера и секция редактора). v2: переключатель режима цены —
// «Фиксированная цена Arlekino» (₽ + за проживание / за ночь, по умолчанию) ⟷ «Правило от цены Level.Travel»
// (% / ₽, значение, округление, min/max, минимальная маржа глобальная / своя); оператор, бейдж, активность.
//
// Оператор выбирается из справочника «Операторы» (lib/operators-api.ts): в Room Type сохраняются
// operatorId и operatorName выбранного оператора — по operatorId Room Type и связан с оператором.
// Пока справочник недоступен (миграция не прогнана) поле остаётся свободной строкой, как раньше.

import { useEffect, useState } from 'react';
import Icon from '@/components/Icon';
import { t, radius, text, cardStyle, button } from '@/lib/theme';
import { Field, Toggle, compactInput, checkboxRow, selectStyle } from '@/components/notifications/shared';
import { formatMoney, type FixedPriceUnit, type PackageType, type PricingInput, type PricingMode, type RoomSettings, type RoomType, type RoomTypeRuleInput, type Rounding, type RuleType } from '@/lib/rooms-api';
import { listOperators, type Operator } from '@/lib/operators-api';
import { Segment } from './shared';

export const DEFAULT_OPERATOR_NAME = 'Arlekino';
export const FIXED_PRICE_MAX = 100000000;

export interface RuleFormState {
    /** v2: режим цены (по умолчанию fixed). */
    pricingMode: PricingMode;
    /** Фиксированная цена, ₽ (строка из инпута). */
    fixedPrice: string;
    fixedPriceUnit: FixedPriceUnit;
    /** Название нашего оператора на витрине. */
    operatorName: string;
    /** operator_id выбранного оператора (990000+); null — оператор из справочника не выбран. */
    operatorId: number | null;
    /** true — packageTypes пустые (любой тип поиска); false — только «отель» (без перелёта). */
    anySearch: boolean;
    ruleType: RuleType;
    ruleValue: string;
    rounding: Rounding;
    minPrice: string;
    maxPrice: string;
    marginMode: 'global' | 'own';
    marginType: RuleType;
    marginValue: string;
    badge: string;
    active: boolean;
}

export function defaultRuleState(settings?: RoomSettings | null): RuleFormState {
    return {
        pricingMode: 'fixed',
        fixedPrice: '',
        fixedPriceUnit: 'total',
        operatorName: DEFAULT_OPERATOR_NAME,
        operatorId: null,
        anySearch: true,
        ruleType: 'percent',
        ruleValue: '-10',
        rounding: ([1, 10, 100].includes(Number(settings?.rounding)) ? Number(settings?.rounding) : 1) as Rounding,
        minPrice: '',
        maxPrice: '',
        marginMode: 'global',
        marginType: settings?.minMarginType || 'percent',
        marginValue: settings?.minMarginValue === null || settings?.minMarginValue === undefined ? '' : String(settings.minMarginValue),
        badge: settings?.badge || 'Totus',
        active: true,
    };
}

export function stateFromRoomType(rt: RoomType, settings?: RoomSettings | null): RuleFormState {
    const own = Boolean(rt.minMarginType) && rt.minMarginValue !== null;
    return {
        pricingMode: rt.pricingMode === 'rule' ? 'rule' : 'fixed',
        fixedPrice: rt.fixedPrice === null || rt.fixedPrice === undefined ? '' : String(rt.fixedPrice),
        fixedPriceUnit: rt.fixedPriceUnit === 'per_night' ? 'per_night' : 'total',
        operatorName: rt.operatorName || DEFAULT_OPERATOR_NAME,
        operatorId: rt.operatorId === null || rt.operatorId === undefined ? null : Number(rt.operatorId),
        anySearch: !(rt.packageTypes || []).length,
        ruleType: rt.ruleType || 'percent',
        ruleValue: rt.ruleValue === null || rt.ruleValue === undefined ? '-10' : String(rt.ruleValue),
        rounding: ([1, 10, 100].includes(Number(rt.rounding)) ? Number(rt.rounding) : 1) as Rounding,
        minPrice: rt.minPrice === null || rt.minPrice === undefined ? '' : String(rt.minPrice),
        maxPrice: rt.maxPrice === null || rt.maxPrice === undefined ? '' : String(rt.maxPrice),
        marginMode: own ? 'own' : 'global',
        marginType: (own ? rt.minMarginType : settings?.minMarginType) || 'percent',
        marginValue: own ? String(rt.minMarginValue) : settings?.minMarginValue === null || settings?.minMarginValue === undefined ? '' : String(settings.minMarginValue),
        badge: rt.badge || settings?.badge || 'Totus',
        active: rt.active,
    };
}

/** Правило для API; null — значение ещё не введено. Своя маржа передаётся только в режиме «Своя», иначе null (глобальная). */
export function ruleFromState(s: RuleFormState): RoomTypeRuleInput | null {
    const value = Number(s.ruleValue);
    if (s.ruleValue.trim() === '' || !Number.isFinite(value)) return null;
    const own = s.marginMode === 'own' && s.marginValue.trim() !== '' && Number.isFinite(Number(s.marginValue));
    return {
        ruleType: s.ruleType,
        ruleValue: value,
        rounding: s.rounding,
        minPrice: s.minPrice.trim() === '' ? null : Number(s.minPrice),
        maxPrice: s.maxPrice.trim() === '' ? null : Number(s.maxPrice),
        minMarginType: own ? s.marginType : null,
        minMarginValue: own ? Number(s.marginValue) : null,
    };
}

/** Режим цены для API / preview; null — данные ещё не введены (нет фикс. цены или значения правила). */
export function pricingFromState(s: RuleFormState): PricingInput | null {
    if (s.pricingMode === 'fixed') {
        const price = Number(s.fixedPrice);
        if (s.fixedPrice.trim() === '' || !Number.isFinite(price) || price <= 0) return null;
        return { pricingMode: 'fixed', fixedPrice: price, fixedPriceUnit: s.fixedPriceUnit };
    }
    const rule = ruleFromState(s);
    return rule ? { pricingMode: 'rule', rule } : null;
}

/** Поля цены для POST/PUT /room-types: режим, фикс. цена, оператор; правило — только в режиме rule. */
export function pricingBodyFromState(s: RuleFormState): { pricingMode: PricingMode; fixedPrice: number | null; fixedPriceUnit: FixedPriceUnit; operatorName: string; operatorId: number | null; rule: RoomTypeRuleInput | null; packageTypes: PackageType[] } {
    const price = Number(s.fixedPrice);
    return {
        pricingMode: s.pricingMode,
        fixedPrice: s.fixedPrice.trim() === '' || !Number.isFinite(price) ? null : price,
        fixedPriceUnit: s.fixedPriceUnit,
        operatorName: s.operatorName.trim() || DEFAULT_OPERATOR_NAME,
        operatorId: s.operatorId,
        rule: s.pricingMode === 'rule' ? ruleFromState(s) : null,
        packageTypes: s.anySearch ? [] : ['hotel'],
    };
}

export function validateRuleState(s: RuleFormState): string | null {
    if (s.pricingMode === 'fixed') {
        const price = Number(s.fixedPrice);
        if (s.fixedPrice.trim() === '' || !Number.isFinite(price) || price <= 0) return 'Укажите фиксированную цену больше нуля';
        if (price > FIXED_PRICE_MAX) return 'Фиксированная цена не может быть больше 100 000 000 ₽';
        return null;
    }
    const rule = ruleFromState(s);
    if (!rule) return 'Укажите значение правила цены';
    if (rule.ruleType === 'percent' && (rule.ruleValue < -90 || rule.ruleValue > 500)) return 'Процент должен быть от −90 до 500';
    if (rule.minPrice !== null && rule.minPrice !== undefined && rule.minPrice < 0) return 'Минимальная цена не может быть отрицательной';
    if (rule.maxPrice !== null && rule.maxPrice !== undefined && rule.maxPrice <= 0) return 'Максимальная цена должна быть больше нуля';
    if (rule.minPrice != null && rule.maxPrice != null && rule.minPrice > rule.maxPrice) return 'Минимальная цена больше максимальной';
    if (s.marginMode === 'own' && s.marginValue.trim() === '') return 'Укажите значение своей минимальной маржи';
    return null;
}

function globalMarginLabel(settings?: RoomSettings | null): string {
    if (!settings?.minMarginType || settings.minMarginValue === null || settings.minMarginValue === undefined) return 'не задана';
    return settings.minMarginType === 'percent' ? `${settings.minMarginValue} %` : formatMoney(settings.minMarginValue);
}

export default function RuleForm({ value, onChange, settings }: { value: RuleFormState; onChange: (next: RuleFormState) => void; settings?: RoomSettings | null }) {
    const set = <K extends keyof RuleFormState>(key: K, v: RuleFormState[K]) => onChange({ ...value, [key]: v });
    const step = value.ruleType === 'percent' ? 1 : 500;
    const bump = (dir: 1 | -1) => set('ruleValue', String((Number(value.ruleValue) || 0) + dir * step));
    const unit = value.ruleType === 'percent' ? '%' : '₽';
    const stepper = { ...button('secondary', 'md'), width: 42, padding: 0 };

    const fixed = value.pricingMode === 'fixed';
    const operator = value.operatorName.trim() || DEFAULT_OPERATOR_NAME;

    // Справочник операторов. null — ещё грузится; пустой массив — справочника нет (миграция не прогнана),
    // тогда поле работает как раньше — свободной строкой.
    const [operators, setOperators] = useState<Operator[] | null>(null);
    useEffect(() => {
        let alive = true;
        listOperators()
            .then((d) => {
                if (alive) setOperators(d.available ? d.operators : []);
            })
            .catch(() => {
                if (alive) setOperators([]);
            });
        return () => {
            alive = false;
        };
    }, []);

    // Новый Room Type (или строка до появления справочника): подставляем оператора по имени,
    // иначе первого активного — чтобы поле не оставалось пустым.
    useEffect(() => {
        if (!operators || !operators.length) return;
        if (value.operatorId && operators.some((o) => o.operatorId === value.operatorId)) return;
        const pick = operators.find((o) => o.name === value.operatorName.trim()) || operators.find((o) => o.active) || operators[0];
        if (!pick) return;
        if (pick.operatorId === value.operatorId && pick.name === value.operatorName) return;
        onChange({ ...value, operatorId: pick.operatorId, operatorName: pick.name });
    }, [operators, value, onChange]);

    const hasCatalog = Boolean(operators && operators.length);
    const unknownOperator = hasCatalog && value.operatorId !== null && !(operators || []).some((o) => o.operatorId === value.operatorId);

    return (
        <div style={{ display: 'grid', gap: 16 }}>
            <div style={{ ...cardStyle, padding: 20, display: 'grid', gap: 14 }}>
                <div>
                    <div style={text.cardTitle}>Как считается цена</div>
                    <div style={text.caption}>Наше предложение {operator} появится у выбранного номера при любых датах и составе гостей</div>
                </div>
                <Segment<PricingMode>
                    fullWidth
                    options={[
                        { value: 'fixed', label: `Фиксированная цена ${operator}` },
                        { value: 'rule', label: 'Правило от цены Level.Travel' },
                    ]}
                    value={value.pricingMode}
                    onChange={(v) => set('pricingMode', v)}
                />
                {fixed ? (
                    <div style={{ display: 'flex', gap: 16, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                        <Field label="Цена" hint="₽, больше нуля">
                            <div style={{ position: 'relative', width: 180 }}>
                                <input
                                    type="number"
                                    min={0}
                                    step={1}
                                    style={{ ...compactInput, fontWeight: 700, paddingRight: 28 }}
                                    value={value.fixedPrice}
                                    onChange={(e) => set('fixedPrice', e.target.value)}
                                    placeholder="1"
                                />
                                <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: t.textTertiary, fontSize: 13 }}>₽</span>
                            </div>
                        </Field>
                        <Field label="Единица">
                            <div role="radiogroup" style={{ display: 'flex', gap: 16, flexWrap: 'wrap', paddingTop: 6 }}>
                                <label style={checkboxRow}>
                                    <input type="radio" name="fixedPriceUnit" checked={value.fixedPriceUnit === 'total'} onChange={() => set('fixedPriceUnit', 'total')} />
                                    за проживание
                                </label>
                                <label style={checkboxRow}>
                                    <input type="radio" name="fixedPriceUnit" checked={value.fixedPriceUnit === 'per_night'} onChange={() => set('fixedPriceUnit', 'per_night')} />
                                    за ночь
                                </label>
                            </div>
                        </Field>
                        <div style={{ ...text.caption, flexBasis: '100%' }}>
                            Цена не зависит от цены Level.Travel: {value.fixedPriceUnit === 'per_night' ? 'умножается на число ночей предложения' : 'одна сумма за всё проживание'}. Минимальная маржа и округление не применяются.
                        </div>
                    </div>
                ) : null}
            </div>

            {!fixed ? (
                <div style={{ ...cardStyle, padding: 20, display: 'grid', gap: 14 }}>
                    <div style={text.cardTitle}>Правило цены</div>
                    <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                        <Field label="Тип правила">
                            <Segment<RuleType> options={[{ value: 'percent', label: 'Процент %' }, { value: 'absolute', label: 'Сумма ₽' }]} value={value.ruleType} onChange={(v) => set('ruleType', v)} />
                        </Field>
                        <Field label="Значение" hint={value.ruleType === 'percent' ? '−90…500' : '± ₽ к цене LT'}>
                            <div style={{ display: 'flex', gap: 6 }}>
                                <button type="button" onClick={() => bump(-1)} aria-label="Уменьшить" style={stepper}><Icon name="minus" size={16} /></button>
                                <div style={{ position: 'relative', width: 140 }}>
                                    <input type="number" step={value.ruleType === 'percent' ? 0.5 : 100} style={{ ...compactInput, textAlign: 'center', fontWeight: 700, paddingRight: 28 }} value={value.ruleValue} onChange={(e) => set('ruleValue', e.target.value)} />
                                    <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: t.textTertiary, fontSize: 13 }}>{unit}</span>
                                </div>
                                <button type="button" onClick={() => bump(1)} aria-label="Увеличить" style={stepper}><Icon name="plus" size={16} /></button>
                            </div>
                        </Field>
                    </div>
                    <Field label="Округление">
                        <Segment<Rounding> fullWidth options={[{ value: 1, label: '1 ₽' }, { value: 10, label: '10 ₽' }, { value: 100, label: '100 ₽' }]} value={value.rounding} onChange={(v) => set('rounding', v)} />
                    </Field>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                        <Field label="Мин. цена">
                            <input type="number" min={0} style={compactInput} value={value.minPrice} onChange={(e) => set('minPrice', e.target.value)} placeholder="Не задана" />
                        </Field>
                        <Field label="Макс. цена">
                            <input type="number" min={0} style={compactInput} value={value.maxPrice} onChange={(e) => set('maxPrice', e.target.value)} placeholder="Не задана" />
                        </Field>
                    </div>

                    <div style={{ borderTop: `1px solid ${t.border}`, paddingTop: 14, display: 'grid', gap: 10 }}>
                        <div>
                            <div style={text.cardTitle}>Минимальная маржа</div>
                            <div style={text.caption}>Ниже порога цена поднимается автоматически, комната помечается «Маржа ограничена»</div>
                        </div>
                        <Segment<'global' | 'own'>
                            fullWidth
                            options={[
                                { value: 'global', label: `Глобальная (${globalMarginLabel(settings)})` },
                                { value: 'own', label: 'Своя' },
                            ]}
                            value={value.marginMode}
                            onChange={(v) => set('marginMode', v)}
                        />
                        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', opacity: value.marginMode === 'own' ? 1 : 0.5 }}>
                            <Field label="Единицы">
                                <Segment<RuleType> disabled={value.marginMode !== 'own'} options={[{ value: 'percent', label: '%' }, { value: 'absolute', label: '₽' }]} value={value.marginType} onChange={(v) => set('marginType', v)} />
                            </Field>
                            <div style={{ flex: 1 }}>
                                <Field label="Значение" hint="N ≥ 0 — допустимая субсидия">
                                    <input type="number" disabled={value.marginMode !== 'own'} style={compactInput} value={value.marginValue} onChange={(e) => set('marginValue', e.target.value)} placeholder={value.marginType === 'percent' ? '15' : '5000'} />
                                </Field>
                            </div>
                        </div>
                    </div>
                </div>
            ) : null}

            <div style={{ ...cardStyle, padding: 20, display: 'grid', gap: 14 }}>
                <div style={text.cardTitle}>Витрина</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    {hasCatalog ? (
                        <Field
                            label="Оператор"
                            hint={
                                <>
                                    так наше предложение подписано на витрине ·{' '}
                                    <a href="/operators" style={{ color: t.accent, textDecoration: 'none' }}>
                                        управлять операторами
                                    </a>
                                </>
                            }
                        >
                            <select
                                style={selectStyle}
                                value={value.operatorId === null ? '' : String(value.operatorId)}
                                onChange={(e) => {
                                    const id = Number(e.target.value);
                                    const op = (operators || []).find((o) => o.operatorId === id);
                                    onChange({ ...value, operatorId: op ? op.operatorId : null, operatorName: op ? op.name : value.operatorName });
                                }}
                            >
                                {unknownOperator ? (
                                    <option value={String(value.operatorId)}>
                                        {operator} · {value.operatorId} (нет в справочнике)
                                    </option>
                                ) : null}
                                {(operators || []).map((o) => (
                                    <option key={o.id} value={String(o.operatorId)}>
                                        {o.name} · {o.operatorId}
                                        {o.active ? '' : ' — выключен'}
                                    </option>
                                ))}
                            </select>
                        </Field>
                    ) : (
                        <Field label="Название оператора" hint="так наше предложение подписано на витрине">
                            <input style={compactInput} value={value.operatorName} onChange={(e) => set('operatorName', e.target.value)} maxLength={128} placeholder={DEFAULT_OPERATOR_NAME} />
                        </Field>
                    )}
                    <Field label="Бейдж" hint="служебная пометка, на витрине не показывается">
                        <input style={compactInput} value={value.badge} onChange={(e) => set('badge', e.target.value)} maxLength={64} placeholder="Totus" />
                    </Field>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <Field label="Показывать при типе поиска" hint="глобально ограничить отелями можно в настройках">
                        <div style={{ display: 'grid', gap: 6, paddingTop: 4 }}>
                            <label style={checkboxRow}>
                                <input type="radio" name="anySearch" checked={value.anySearch} onChange={() => set('anySearch', true)} />
                                Любой (отель и тур с перелётом)
                            </label>
                            <label style={checkboxRow}>
                                <input type="radio" name="anySearch" checked={!value.anySearch} onChange={() => set('anySearch', false)} />
                                Только отель (без перелёта)
                            </label>
                        </div>
                    </Field>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '10px 12px', borderRadius: radius.sm, background: t.surfaceInset }}>
                    <div>
                        <div style={{ fontSize: 14, fontWeight: 600, color: t.textPrimary }}>Активность</div>
                        <div style={text.caption}>Показывать на витрине у выбранного номера Level.Travel</div>
                    </div>
                    <Toggle checked={value.active} onChange={(v) => set('active', v)} label="Активность" />
                </div>
            </div>
        </div>
    );
}
