'use client';

// Вкладка «Настройки»: глобальная минимальная маржа, округление, бейдж, «показывать только при поиске отелей» (v2: выкл по умолчанию).

import { useEffect, useState } from 'react';
import { t, text, button, cardStyle } from '@/lib/theme';
import { Field, ErrorBox, SuccessBox, Toggle, compactInput } from '@/components/notifications/shared';
import { getRoomSettings, updateRoomSettings, type RoomSettings, type Rounding, type RuleType } from '@/lib/rooms-api';
import { Segment, Spinner } from './shared';

const ROUNDING_OPTIONS: { value: Rounding; label: string }[] = [
    { value: 1, label: '1 ₽' },
    { value: 10, label: '10 ₽' },
    { value: 100, label: '100 ₽' },
];

export default function SettingsTab() {
    const [settings, setSettings] = useState<RoomSettings | null>(null);
    const [marginEnabled, setMarginEnabled] = useState(false);
    const [marginType, setMarginType] = useState<RuleType>('percent');
    const [marginValue, setMarginValue] = useState('');
    const [rounding, setRounding] = useState<Rounding>(1);
    const [badgeText, setBadgeText] = useState('Totus');
    const [hotelOnly, setHotelOnly] = useState(false);
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [done, setDone] = useState<string | null>(null);

    const apply = (s: RoomSettings) => {
        setSettings(s);
        setMarginEnabled(Boolean(s.minMarginType));
        setMarginType(s.minMarginType || 'percent');
        setMarginValue(s.minMarginValue === null || s.minMarginValue === undefined ? '' : String(s.minMarginValue));
        setRounding(([1, 10, 100].includes(Number(s.rounding)) ? Number(s.rounding) : 1) as Rounding);
        setBadgeText(s.badge || 'Totus');
        setHotelOnly(s.hotelOnly === true);
    };

    useEffect(() => {
        getRoomSettings()
            .then(apply)
            .catch((e: any) => setError(e?.message || 'Не удалось загрузить настройки'))
            .finally(() => setLoading(false));
    }, []);

    const save = async () => {
        setError(null);
        setDone(null);
        if (marginEnabled && marginValue.trim() === '') {
            setError('Укажите значение минимальной маржи или отключите её');
            return;
        }
        setBusy(true);
        try {
            const next = await updateRoomSettings({
                minMarginType: marginEnabled ? marginType : null,
                minMarginValue: marginEnabled ? Number(marginValue) : null,
                rounding,
                badge: badgeText.trim() || 'Totus',
                hotelOnly,
            });
            apply(next);
            setDone('Настройки сохранены');
        } catch (e: any) {
            setError(e?.message || 'Не удалось сохранить настройки');
        } finally {
            setBusy(false);
        }
    };

    if (loading) return <Spinner label="Загружаем настройки..." />;

    return (
        <div style={{ display: 'grid', gap: 16, maxWidth: 720 }}>
            <ErrorBox message={error} />
            {settings ? (
                <>
                    <div style={{ ...cardStyle, padding: 20, display: 'grid', gap: 14 }}>
                        <div>
                            <div style={text.cardTitle}>Минимальная маржа по умолчанию</div>
                            <div style={text.caption}>
                                Порог «не ниже цены провайдера − N». N ≥ 0 — допустимая субсидия, N &lt; 0 — обязательная наценка.
                                Если Final Price ниже порога, цена поднимается до порога, комната помечается «Маржа ограничена».
                                На комнате порог можно переопределить.
                            </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            <Toggle checked={marginEnabled} onChange={setMarginEnabled} label="Минимальная маржа" />
                            <span style={{ fontSize: 14, color: t.textPrimary }}>{marginEnabled ? 'Порог задан' : 'Не задана — без ограничения'}</span>
                        </div>
                        {marginEnabled ? (
                            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                                <Field label="Единицы">
                                    <Segment<RuleType> options={[{ value: 'percent', label: '%' }, { value: 'absolute', label: '₽' }]} value={marginType} onChange={setMarginType} />
                                </Field>
                                <div style={{ width: 200 }}>
                                    <Field label="Значение" hint={marginType === 'percent' ? 'от −100 до 100' : '₽'}>
                                        <input type="number" step={marginType === 'percent' ? 0.5 : 100} style={compactInput} value={marginValue} onChange={(e) => setMarginValue(e.target.value)} placeholder={marginType === 'percent' ? '15' : '5000'} />
                                    </Field>
                                </div>
                            </div>
                        ) : null}
                    </div>

                    <div style={{ ...cardStyle, padding: 20, display: 'grid', gap: 14 }}>
                        <div style={text.cardTitle}>Витрина</div>
                        <Field label="Округление по умолчанию" hint="для новых Room Type">
                            <Segment<Rounding> options={ROUNDING_OPTIONS} value={rounding} onChange={setRounding} />
                        </Field>
                        <div style={{ maxWidth: 320 }}>
                            <Field label="Бейдж по умолчанию" hint="служебная пометка, на витрине не показывается">
                                <input style={compactInput} value={badgeText} onChange={(e) => setBadgeText(e.target.value)} maxLength={64} />
                            </Field>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            <Toggle checked={hotelOnly} onChange={setHotelOnly} label="Показывать только при поиске отелей (без перелёта)" />
                            <div>
                                <div style={{ fontSize: 14, color: t.textPrimary }}>Показывать наши Room Type только при поиске отелей (без перелёта)</div>
                                <div style={text.caption}>По умолчанию выключено: наши предложения видны при любом типе поиска (отель и тур с перелётом), если у самого Room Type не ограничен тип поиска</div>
                            </div>
                        </div>
                    </div>

                    <SuccessBox message={done} />
                    <div>
                        <button type="button" onClick={save} disabled={busy} style={{ ...button('primary', 'md'), opacity: busy ? 0.6 : 1 }}>
                            {busy ? 'Сохраняем...' : 'Сохранить'}
                        </button>
                    </div>
                </>
            ) : null}
        </div>
    );
}
