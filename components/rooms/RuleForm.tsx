'use client';

// Правило цены и витрина (шаг 3 мастера и секция редактора): % / ₽, значение, округление, min/max,
// минимальная маржа (глобальная / своя), бейдж, тип пакета, активность.

import Icon from '@/components/Icon';
import { t, radius, text, cardStyle, button } from '@/lib/theme';
import { Field, Toggle, compactInput, checkboxRow } from '@/components/notifications/shared';
import { formatMoney, type RoomSettings, type RoomType, type RoomTypeRuleInput, type Rounding, type RuleType } from '@/lib/rooms-api';
import { Segment } from './shared';

export interface RuleFormState {
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
        ruleType: rt.ruleType,
        ruleValue: String(rt.ruleValue),
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

export function validateRuleState(s: RuleFormState): string | null {
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

    return (
        <div style={{ display: 'grid', gap: 16 }}>
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

            <div style={{ ...cardStyle, padding: 20, display: 'grid', gap: 14 }}>
                <div style={text.cardTitle}>Витрина</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <Field label="Бейдж" hint="служебная пометка, на витрине не показывается">
                        <input style={compactInput} value={value.badge} onChange={(e) => set('badge', e.target.value)} maxLength={64} placeholder="Totus" />
                    </Field>
                    <Field label="Показывать при типе пакета">
                        <div style={{ display: 'grid', gap: 6, paddingTop: 4 }}>
                            <label style={checkboxRow}>
                                <input type="checkbox" checked readOnly />
                                Отель (без перелёта)
                            </label>
                            <label style={{ ...checkboxRow, color: t.textDisabled, cursor: 'not-allowed' }}>
                                <input type="checkbox" checked={false} disabled readOnly />
                                Тур с перелётом — недоступно
                            </label>
                        </div>
                    </Field>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '10px 12px', borderRadius: radius.sm, background: t.surfaceInset }}>
                    <div>
                        <div style={{ fontSize: 14, fontWeight: 600, color: t.textPrimary }}>Активность</div>
                        <div style={text.caption}>Показывать на витрине вместо выбранных предложений</div>
                    </div>
                    <Toggle checked={value.active} onChange={(v) => set('active', v)} label="Активность" />
                </div>
            </div>
        </div>
    );
}
