'use client';

// Live-предпросмотр цены: POST /room-types/preview-price (debounce) по актуальным предложениям источника.
// Таблица «Оператор · Питание · Цена LT → Наша · Маржа» + предупреждение при margin_clamped + «Так увидит пользователь».
// v2: режим цены (pricingMode) — fixed считается и без предложений (по числу ночей), rule — как раньше.

import { useEffect, useMemo, useState } from 'react';
import Icon from '@/components/Icon';
import { t, radius, text, cardStyle, button } from '@/lib/theme';
import { ErrorBox } from '@/components/notifications/shared';
import { previewPrice, formatMoney, ruleLabel, fixedPriceLabel, type PreviewResult, type PreviewRow, type PricingInput, type RoomSettings, type RoomTypeRuleInput } from '@/lib/rooms-api';
import { Thumb, useDebounced, tableStyle, thStyle, tdStyle, tdRight, thRight, TableWrap, Spinner, plural } from './shared';

export interface PreviewOffer {
    operator_name?: string | null;
    meal?: string | null;
    price: number;
    nights_count?: number | null;
}

export function marginText(settings: RoomSettings | null | undefined, rule?: RoomTypeRuleInput | null): string {
    const type = rule?.minMarginType ?? settings?.minMarginType ?? null;
    const value = rule?.minMarginType ? rule.minMarginValue : settings?.minMarginValue;
    if (!type || value === null || value === undefined) return 'не задана';
    const own = Boolean(rule?.minMarginType);
    return `${type === 'percent' ? `${value} %` : formatMoney(Number(value))}${own ? ' (своя)' : ' (глобальная)'}`;
}

export default function PricePreview({
    pricing,
    offers,
    settings,
    subtitle,
    onRefresh,
    refreshing,
    userCard,
    nights,
}: {
    /** Режим цены (fixed / rule); null — данные ещё не введены. */
    pricing: PricingInput | null;
    offers: PreviewOffer[];
    settings?: RoomSettings | null;
    subtitle?: string;
    onRefresh?: () => void;
    refreshing?: boolean;
    /** Мини-карточка «Так увидит пользователь» (без бейджа — на витрине наши комнаты не помечаются). */
    userCard?: { name: string; meta?: string; photo?: string; sourceName?: string | null; operator?: string | null };
    nights?: number;
}) {
    const key = useMemo(() => JSON.stringify({ pricing, offers, nights: nights || null }), [pricing, offers, nights]);
    const debouncedKey = useDebounced(key, 350);
    const [result, setResult] = useState<PreviewResult | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const fixed = pricing?.pricingMode === 'fixed';
    const rule: RoomTypeRuleInput | null = pricing?.pricingMode === 'rule' ? pricing.rule || null : null;

    useEffect(() => {
        const parsed = JSON.parse(debouncedKey) as { pricing: PricingInput | null; offers: PreviewOffer[]; nights: number | null };
        // rule — нужны предложения-шаблоны; fixed — считается и без них (по числу ночей поиска)
        if (!parsed.pricing || (parsed.pricing.pricingMode === 'rule' && !parsed.offers.length)) {
            setResult(null);
            return;
        }
        let cancelled = false;
        setLoading(true);
        setError(null);
        previewPrice({ ...parsed.pricing, offers: parsed.offers, nights: parsed.nights })
            .then((r) => {
                if (!cancelled) setResult(r);
            })
            .catch((e: any) => {
                if (!cancelled) setError(e?.message || 'Не удалось рассчитать цену');
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, [debouncedKey]);

    const rows: PreviewRow[] = result?.rows || [];
    const clamped = rows.some((r) => r.margin_clamped);
    const best = rows.filter((r) => r.final_price != null).sort((a, b) => (a.final_price || 0) - (b.final_price || 0))[0];
    const marginLabel = marginText(settings, rule);
    const priceLabel = result?.label || (fixed ? fixedPriceLabel(pricing?.fixedPrice, pricing?.fixedPriceUnit) : ruleLabel(rule));

    return (
        <div style={{ display: 'grid', gap: 16 }}>
            <div style={{ ...cardStyle, padding: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 12 }}>
                    <div>
                        <div style={text.cardTitle}>Предпросмотр цены по актуальной выдаче</div>
                        {subtitle ? <div style={text.caption}>{subtitle}</div> : null}
                    </div>
                    {onRefresh ? (
                        <button type="button" onClick={onRefresh} disabled={refreshing} style={button('secondary', 'sm')}>
                            <Icon name="refresh" size={14} />
                            Обновить
                        </button>
                    ) : null}
                </div>

                <ErrorBox message={error} />

                {!pricing ? <div style={text.body}>Укажите фиксированную цену или правило — расчёт появится здесь.</div> : null}
                {pricing && !fixed && !offers.length ? (
                    <div style={text.body}>Нет актуальных предложений источника — расчёт недоступен. Откройте отель из свежего поиска.</div>
                ) : null}
                {pricing && fixed && !offers.length ? (
                    <div style={{ ...text.caption, marginBottom: 8 }}>Нет актуальных предложений номера — маржа неизвестна; показана наша фиксированная цена{nights ? ` за ${nights} ${plural(nights, 'ночь', 'ночи', 'ночей')}` : ''}.</div>
                ) : null}

                {loading && !result ? <Spinner label="Считаем..." /> : null}

                {rows.length ? (
                    <div style={{ opacity: loading ? 0.6 : 1 }}>
                        <TableWrap>
                            <table style={tableStyle}>
                                <thead>
                                    <tr>
                                        <th style={thStyle}>Шаблон LT</th>
                                        <th style={thStyle}>Питание</th>
                                        <th style={thRight}>Цена LT</th>
                                        <th style={thRight}>Наша цена</th>
                                        <th style={thRight}>Маржа</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {rows.map((r, i) => (
                                        <tr key={`${r.operator_name}-${r.meal}-${i}`} style={{ background: r.margin_clamped ? t.warningSoft : undefined }}>
                                            <td style={tdStyle}>{r.operator_name || '—'}</td>
                                            <td style={tdStyle}>{r.meal || '—'}</td>
                                            <td style={tdRight}>{formatMoney(r.provider_price)}</td>
                                            <td style={{ ...tdRight, fontWeight: 700 }}>{formatMoney(r.final_price)}</td>
                                            <td style={{ ...tdRight, color: r.margin == null ? t.textTertiary : r.margin < 0 ? t.error : t.success }}>
                                                {formatMoney(r.margin, true)}
                                                {r.margin_percent != null ? <span style={{ color: t.textTertiary }}> ({r.margin_percent > 0 ? '+' : ''}{r.margin_percent} %)</span> : null}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </TableWrap>
                        <div
                            style={{
                                marginTop: 12,
                                padding: '10px 12px',
                                borderRadius: radius.sm,
                                background: clamped ? t.errorSoft : fixed ? t.accentSoft : t.warningSoft,
                                color: clamped ? t.error : t.textPrimary,
                                fontSize: 13,
                                lineHeight: '18px',
                                display: 'flex',
                                gap: 8,
                                alignItems: 'flex-start',
                            }}
                        >
                            <Icon name="info" size={16} style={{ marginTop: 1, flexShrink: 0 }} />
                            <span>
                                {fixed
                                    ? `Фиксированная цена ${priceLabel}: не зависит от цены Level.Travel, минимальная маржа и округление не применяются. Маржа — разница с самым дешёвым предложением номера (шаблоном).`
                                    : clamped
                                    ? `Цена поднята до порога минимальной маржи ${marginLabel}: правило ${priceLabel} даёт субсидию больше допустимой. Комната будет помечена «Маржа ограничена».`
                                    : `Минимальная маржа ${marginLabel} не нарушена: правило ${priceLabel} в пределах порога.`}
                            </span>
                        </div>
                    </div>
                ) : null}
            </div>

            {userCard && best ? (
                <div style={{ ...cardStyle, padding: 20 }}>
                    <div style={{ ...text.cardTitle, marginBottom: 12 }}>Так увидит пользователь</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: 14, borderRadius: radius.md, border: `1px solid ${t.accentBorder}`, borderLeft: `4px solid ${t.accent}`, background: t.surface }}>
                        <Thumb src={userCard.photo} width={110} height={80} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ ...text.cardTitle, fontSize: 15 }}>{userCard.name || 'Без названия'}</div>
                            {userCard.meta ? <div style={{ ...text.body, marginTop: 2 }}>{userCard.meta}</div> : null}
                            <div style={{ ...text.caption, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                Наше предложение{userCard.sourceName ? ` · на основе номера «${userCard.sourceName}»` : ''}{userCard.operator ? ` · ${userCard.operator}` : ''}
                            </div>
                        </div>
                        <div style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                            <div style={{ fontSize: 20, fontWeight: 700, color: t.accent }}>{formatMoney(best.final_price)}</div>
                            <div style={text.caption}>{best.meal || ''}{best.nights_count || nights ? ` · за ${best.nights_count || nights} ${plural(Number(best.nights_count || nights), 'ночь', 'ночи', 'ночей')}` : ''}{fixed ? ' · фикс.' : ''}</div>
                        </div>
                    </div>
                    <div style={{ ...text.caption, marginTop: 8 }}>
                        Показывается у номера как оператор {userCard.operator || 'Arlekino'} при любых датах и составе гостей · оплата нашей цены · бронирование подтверждает сотрудник
                    </div>
                </div>
            ) : null}
        </div>
    );
}
