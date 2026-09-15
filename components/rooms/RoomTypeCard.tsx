'use client';

// Карточка нашего Room Type (под номером LT или в списке отеля): brand-полоса, цена (v2: «1 ₽ (фикс.)» / правило),
// «Провайдер → Наша», маржа, статус по актуальной выдаче, действия.

import { t, radius, text, button, badge } from '@/lib/theme';
import { Toggle } from '@/components/notifications/shared';
import type { RoomType } from '@/lib/rooms-api';
import { STATUS_META, roomTypeStatus, roomTypeLabel, statusText, BrandBadge, PricePair } from './shared';

/** Цены для карточки: первая строка preview по выдаче (мин. цена провайдера), иначе `last`. */
export function cardPrices(rt: RoomType): { provider: number | null; final: number | null; margin: number | null } {
    const rows = (rt.preview || []).filter((r) => r.final_price != null);
    if (rows.length) {
        const best = [...rows].sort((a, b) => (a.provider_price ?? Infinity) - (b.provider_price ?? Infinity))[0];
        return { provider: best.provider_price, final: best.final_price, margin: best.margin };
    }
    const provider = rt.last?.providerPrice ?? null;
    // v2 fixed: наша цена известна всегда (previewPrice = фиксированная), даже если ещё не показывались
    const final = rt.pricingMode === 'fixed' ? (rt.previewPrice ?? rt.fixedPrice ?? rt.last?.finalPrice ?? null) : (rt.last?.finalPrice ?? rt.previewPrice ?? null);
    return { provider, final, margin: provider != null && final != null ? final - provider : null };
}

export default function RoomTypeCard({
    rt,
    onEdit,
    onDuplicate,
    onToggle,
    busy,
    showHotel,
}: {
    rt: RoomType;
    onEdit: () => void;
    onDuplicate: () => void;
    onToggle: (active: boolean) => void;
    busy?: boolean;
    showHotel?: boolean;
}) {
    const status = roomTypeStatus(rt);
    const meta = STATUS_META[status];
    const prices = cardPrices(rt);
    const fixed = rt.pricingMode === 'fixed';
    const replaces = rt.operatorIds?.length ? ` · замещает ${rt.operatorNames?.length ? rt.operatorNames.join(', ') : `оператора ${rt.operatorIds.join(', ')}`}` : '';
    const meals = rt.mealTypes?.length ? rt.mealTypes.join(', ') : 'самое дешёвое питание';

    return (
        <div
            style={{
                display: 'flex',
                alignItems: 'center',
                gap: 16,
                padding: '14px 16px',
                borderRadius: radius.md,
                border: `1px solid ${t.border}`,
                borderLeft: `4px solid ${t.accent}`,
                background: t.surface,
                boxShadow: t.shadowCard,
                opacity: rt.active ? 1 : 0.75,
            }}
        >
            <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <BrandBadge label={rt.badge} />
                    <span style={{ ...text.cardTitle, fontSize: 15 }}>{rt.content?.nameRu}</span>
                    <span style={badge(fixed ? 'accent' : 'neutral')}>{fixed ? 'Цена' : 'Правило'} {roomTypeLabel(rt)}</span>
                </div>
                <div style={{ ...text.caption, marginTop: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {showHotel && rt.hotelName ? `${rt.hotelName} · ` : ''}
                    {rt.operatorName || 'Arlekino'} · у номера «{rt.sourceRoomName || `#${rt.sourceRoomId}`}» · {meals}{replaces}
                </div>
                <div style={{ marginTop: 8 }}>
                    <span style={{ ...badge(meta.tone), fontSize: 12 }}>{statusText(rt)}</span>
                </div>
            </div>
            <PricePair provider={prices.provider} final={prices.final} margin={prices.margin} compact fixed={fixed} perNight={fixed && rt.fixedPriceUnit === 'per_night' && prices.final != null && prices.final === rt.fixedPrice} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                <button type="button" onClick={onEdit} style={button('secondary', 'sm')}>Изменить</button>
                <button type="button" onClick={onDuplicate} disabled={busy} style={button('secondary', 'sm')}>Дублировать</button>
                <span style={{ ...text.caption, marginLeft: 4 }}>{rt.active ? 'Вкл' : 'Выкл'}</span>
                <Toggle checked={rt.active} onChange={onToggle} disabled={busy} label={rt.active ? 'Выключить' : 'Включить'} />
            </div>
        </div>
    );
}
