'use client';

// Вкладка «Настройки»: глобальная минимальная маржа, округление, бейдж, «показывать только при поиске отелей» (v2: выкл по умолчанию),
// блок «Диагностика» — GET /api/admin/rooms/diagnostics: почему активный Room Type не виден на сайте (без логов сервера).
// §2.3: в диагностике — наличие колонок exclusive/exclusive_scope (без них флаг «только наши предложения» сохранять нельзя).

import { useEffect, useState } from 'react';
import { t, radius, text, button, cardStyle, badge } from '@/lib/theme';
import { Field, ErrorBox, SuccessBox, Toggle, compactInput } from '@/components/notifications/shared';
import { getRoomSettings, updateRoomSettings, getDiagnostics, type Diagnostics, type RoomSettings, type Rounding, type RuleType } from '@/lib/rooms-api';
import { Segment, Spinner, formatDateTime, skipReasonText, tableStyle, thStyle, tdStyle, TableWrap } from './shared';

const ROUNDING_OPTIONS: { value: Rounding; label: string }[] = [
    { value: 1, label: '1 ₽' },
    { value: 10, label: '10 ₽' },
    { value: 100, label: '100 ₽' },
];

function Stat({ label, value, warn }: { label: string; value: string | number; warn?: boolean }) {
    return (
        <div style={{ padding: '8px 12px', borderRadius: radius.sm, background: t.surfaceInset, minWidth: 120 }}>
            <div style={text.caption}>{label}</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: warn ? t.warning : t.textPrimary }}>{value}</div>
        </div>
    );
}

/** Диагностика витрины: миграция, подключение middleware в app.js, счётчики /hotels-rooms, причина пропуска каждой Room Type, подсказки. */
function DiagnosticsCard() {
    const [data, setData] = useState<Diagnostics | null>(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showEvents, setShowEvents] = useState(false);

    const load = async (recheck: boolean) => {
        setBusy(true);
        setError(null);
        try {
            setData(await getDiagnostics(recheck));
        } catch (e: any) {
            setError(e?.message || 'Не удалось получить диагностику');
        } finally {
            setBusy(false);
        }
    };

    const mw = data?.appJsHooks?.middleware;
    return (
        <div style={{ ...cardStyle, padding: 20, display: 'grid', gap: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
                <div>
                    <div style={text.cardTitle}>Диагностика витрины</div>
                    <div style={text.caption}>Почему активный Room Type не виден на сайте: миграция, подключение в app.js, запросы /hotels-rooms, причина пропуска по каждой комнате</div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                    <button type="button" onClick={() => load(false)} disabled={busy} style={{ ...button(data ? 'secondary' : 'primary', 'md'), opacity: busy ? 0.6 : 1 }}>
                        {busy ? 'Проверяем...' : data ? 'Обновить' : 'Диагностика'}
                    </button>
                    {data ? (
                        <button type="button" onClick={() => load(true)} disabled={busy} style={{ ...button('secondary', 'md'), opacity: busy ? 0.6 : 1 }} title="Перепроверить таблицы и колонки в БД прямо сейчас">
                            Перепроверить БД
                        </button>
                    ) : null}
                </div>
            </div>
            <ErrorBox message={error} />
            {data ? (
                <>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                        <span style={badge(data.ready ? 'success' : 'error')}>{data.ready ? 'Модуль включён' : `Модуль выключен: ${data.disabledReason || 'миграция не выполнена'}`}</span>
                        <span style={badge(mw?.mounted ? 'success' : 'error')}>{mw?.mounted ? 'Middleware подключён в app.js' : 'Middleware НЕ подключён (app.js / pm2 restart)'}</span>
                        <span style={badge(data.diagColumns ? 'neutral' : 'warning')}>{data.diagColumns ? 'Колонки диагностики есть' : 'Нет колонок диагностики — повторить миграцию'}</span>
                        {data.exclusiveColumns === undefined ? null : (
                            <span style={badge(data.exclusiveColumns ? 'neutral' : 'warning')}>
                                {data.exclusiveColumns ? 'Колонки «только наши предложения» есть' : 'Нет колонок «только наши предложения»'}
                            </span>
                        )}
                        {data.settings?.hotelOnly ? <span style={badge('warning')}>Включено «только поиск отелей» — сайт ищет package</span> : null}
                    </div>
                    {data.exclusiveColumns === false ? (
                        <div style={{ padding: '10px 12px', borderRadius: radius.sm, background: t.warningSoft, color: t.textPrimary, fontSize: 13, lineHeight: '18px' }}>
                            Флаг «только наши предложения» недоступен: выполните миграцию <span style={text.mono}>node scripts/run-custom-rooms-migration.js</span> и перезапустите API
                        </div>
                    ) : null}
                    {data.missingTables.length || data.missingColumns.length ? (
                        <div style={text.caption}>
                            {data.missingTables.length ? `Нет таблиц: ${data.missingTables.join(', ')}. ` : ''}
                            {data.missingColumns.length ? `Нет колонок: ${data.missingColumns.join(', ')}.` : ''}
                        </div>
                    ) : null}
                    {mw ? (
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                            <Stat label="Запросов через middleware" value={mw.middlewareCalls} warn={mw.middlewareCalls === 0} />
                            <Stat label="/start-search" value={mw.startSearchSeen} />
                            <Stat label="/hotels-rooms обработано" value={mw.hotelsRoomsSeen} warn={mw.hotelsRoomsSeen === 0} />
                            <Stat label="…с вставкой наших предложений" value={mw.hotelsRoomsInjected} warn={mw.hotelsRoomsSeen > 0 && mw.hotelsRoomsInjected === 0} />
                            <Stat label="Ошибок трансформации" value={mw.hotelsRoomsErrors} warn={mw.hotelsRoomsErrors > 0} />
                            <Stat label="Пропущено (модуль выключен)" value={mw.notReadySkips} warn={mw.notReadySkips > 0} />
                        </div>
                    ) : null}
                    {mw ? (
                        <div style={text.caption}>
                            Счётчики с {formatDateTime(mw.startedAt)} (pm2 restart обнуляет). Последний /hotels-rooms: {mw.lastHotelsRoomsAt ? `${formatDateTime(mw.lastHotelsRoomsAt)} · отель ${mw.lastHotelsRoomsHotelId} · search_type ${mw.lastHotelsRoomsSearchType || '—'}` : 'не было'}.
                            {mw.lastError ? ` Последняя ошибка: ${mw.lastError.message}` : ''}
                        </div>
                    ) : null}
                    {data.hints.length ? (
                        <div style={{ padding: '10px 12px', borderRadius: radius.sm, background: t.warningSoft, color: t.textPrimary, fontSize: 13, lineHeight: '18px', display: 'grid', gap: 6 }}>
                            {data.hints.map((h, i) => <div key={i}>• {h}</div>)}
                        </div>
                    ) : data.ready ? (
                        <div style={{ padding: '10px 12px', borderRadius: radius.sm, background: t.successSoft, color: t.success, fontSize: 13 }}>Проблем не найдено: наши предложения вставляются в номера в ответах /hotels-rooms.</div>
                    ) : null}
                    {data.activeRoomTypes.length ? (
                        <TableWrap>
                            <table style={tableStyle}>
                                <thead>
                                    <tr>
                                        <th style={thStyle}>Room Type</th>
                                        <th style={thStyle}>Отель</th>
                                        <th style={thStyle}>Номер-источник</th>
                                        <th style={thStyle}>Цена</th>
                                        <th style={thStyle}>Тип поиска</th>
                                        <th style={thStyle}>Показан</th>
                                        <th style={thStyle}>Проверен</th>
                                        <th style={thStyle}>Причина пропуска</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {data.activeRoomTypes.map((rt) => (
                                        <tr key={rt.id}>
                                            <td style={tdStyle}>#{rt.id}</td>
                                            <td style={tdStyle}>{rt.hotelName || '—'} <span style={text.caption}>({rt.hotelId})</span></td>
                                            <td style={tdStyle}>{rt.sourceRoomName || '—'} <span style={text.caption}>(id {rt.sourceRoomId})</span></td>
                                            <td style={{ ...tdStyle, color: rt.pricingOk ? t.textPrimary : t.error }}>{rt.pricingOk ? rt.pricingLabel || rt.pricingMode : 'не задана'}</td>
                                            <td style={tdStyle}>{rt.packageTypes?.length ? rt.packageTypes.join(', ') : 'любой'}</td>
                                            <td style={tdStyle}>{rt.lastSeenAt ? formatDateTime(rt.lastSeenAt) : 'ещё нет'}</td>
                                            <td style={tdStyle}>{rt.lastCheckedAt ? formatDateTime(rt.lastCheckedAt) : 'ещё нет'}</td>
                                            <td style={{ ...tdStyle, color: rt.lastSkipReason ? t.warning : t.success, maxWidth: 360, wordBreak: 'break-word' }} title={rt.lastSkipReason || ''}>
                                                {rt.lastSkipReason ? skipReasonText(rt.lastSkipReason) : rt.lastSeenAt ? 'вставлена' : '—'}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </TableWrap>
                    ) : data.ready ? (
                        <div style={text.caption}>Нет активных Room Type.</div>
                    ) : null}
                    {data.events.length ? (
                        <div>
                            <button type="button" onClick={() => setShowEvents((v) => !v)} style={button('tertiary', 'sm')}>
                                {showEvents ? 'Скрыть журнал' : `Журнал middleware (${data.events.length})`}
                            </button>
                            {showEvents ? (
                                <pre style={{ ...text.mono, marginTop: 8, padding: 12, borderRadius: radius.sm, background: t.surfaceInset, color: t.textSecondary, whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxHeight: 320, overflow: 'auto' }}>
                                    {data.events.map((e) => `${e.at} ${e.line}`).join('\n')}
                                </pre>
                            ) : null}
                        </div>
                    ) : null}
                </>
            ) : null}
        </div>
    );
}

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
            <DiagnosticsCard />
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
