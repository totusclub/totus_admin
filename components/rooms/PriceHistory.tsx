'use client';

// История цен Room Type: график (цена LT и наша по времени) + таблица price-log + история правок.

import { useEffect, useMemo, useState } from 'react';
import { t, radius, text, cardStyle, button } from '@/lib/theme';
import { ErrorBox, StatusBadge, selectStyle } from '@/components/notifications/shared';
import { getPriceLog, getChangeLog, formatMoney, ruleLabel, snapshotLabel, type ChangeLogItem, type PriceLogItem, type RoomType } from '@/lib/rooms-api';
import { formatDateTime, formatShortDateTime, describeChange, Empty, Spinner, TableWrap, tableStyle, thStyle, tdStyle, tdRight, thRight } from './shared';

const PERIODS: { value: number; label: string }[] = [
    { value: 7, label: '7 дней' },
    { value: 30, label: '30 дней' },
    { value: 90, label: '90 дней' },
    { value: 0, label: 'Всё время' },
];

/** Простой линейный график: две полилинии по времени. */
export function PriceChart({ items }: { items: PriceLogItem[] }) {
    const points = useMemo(() => [...items].filter((i) => i.seenAt).sort((a, b) => new Date(a.seenAt!).getTime() - new Date(b.seenAt!).getTime()), [items]);
    if (points.length < 2) {
        return <div style={{ ...text.caption, padding: '24px 0', textAlign: 'center' }}>Недостаточно данных для графика — нужно хотя бы две точки.</div>;
    }
    const W = 760;
    const H = 220;
    const padL = 64;
    const padR = 16;
    const padT = 16;
    const padB = 28;
    const xs = points.map((p) => new Date(p.seenAt!).getTime());
    const ys = points.flatMap((p) => [p.providerPrice, p.finalPrice]);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const spanY = maxY - minY || Math.max(1, maxY * 0.1);
    const yLo = minY - spanY * 0.1;
    const yHi = maxY + spanY * 0.1;
    const x = (v: number) => padL + ((v - minX) / (maxX - minX || 1)) * (W - padL - padR);
    const y = (v: number) => padT + (1 - (v - yLo) / (yHi - yLo)) * (H - padT - padB);
    const line = (key: 'providerPrice' | 'finalPrice') => points.map((p, i) => `${i ? 'L' : 'M'}${x(xs[i]).toFixed(1)},${y(p[key]).toFixed(1)}`).join(' ');
    const ticksY = [0, 0.5, 1].map((k) => yLo + (yHi - yLo) * k);
    const ticksX = [0, 0.5, 1].map((k) => minX + (maxX - minX) * k);
    const fmtX = (ms: number) => new Date(ms).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });

    return (
        <div style={{ overflowX: 'auto' }}>
            <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ maxWidth: W, display: 'block', minWidth: 480 }} role="img" aria-label="График цены Level.Travel и нашей цены">
                {ticksY.map((v) => (
                    <g key={v}>
                        <line x1={padL} x2={W - padR} y1={y(v)} y2={y(v)} stroke={t.border} strokeDasharray="3 3" />
                        <text x={padL - 8} y={y(v) + 4} textAnchor="end" fontSize="11" fill={t.textTertiary}>{formatMoney(Math.round(v))}</text>
                    </g>
                ))}
                {ticksX.map((v, i) => (
                    <text key={i} x={x(v)} y={H - 8} textAnchor={i === 0 ? 'start' : i === 2 ? 'end' : 'middle'} fontSize="11" fill={t.textTertiary}>{fmtX(v)}</text>
                ))}
                <path d={line('providerPrice')} fill="none" stroke={t.textTertiary} strokeWidth="2" strokeLinejoin="round" />
                <path d={line('finalPrice')} fill="none" stroke={t.accent} strokeWidth="2.5" strokeLinejoin="round" />
                {points.map((p, i) => (
                    <g key={p.id}>
                        <circle cx={x(xs[i])} cy={y(p.providerPrice)} r="3" fill={t.textTertiary} />
                        <circle cx={x(xs[i])} cy={y(p.finalPrice)} r="3.5" fill={p.marginClamped ? t.error : t.accent} />
                    </g>
                ))}
            </svg>
            <div style={{ display: 'flex', gap: 16, marginTop: 8, fontSize: 12, color: t.textSecondary }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><span style={{ width: 14, height: 3, background: t.textTertiary, borderRadius: 2 }} /> Цена Level.Travel</span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><span style={{ width: 14, height: 3, background: t.accent, borderRadius: 2 }} /> Наша цена</span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><span style={{ width: 8, height: 8, background: t.error, borderRadius: radius.pill }} /> маржа ограничена</span>
            </div>
        </div>
    );
}

export function ChangeLogList({ items, loading }: { items: ChangeLogItem[]; loading?: boolean }) {
    if (loading) return <Spinner label="Загружаем историю правок..." />;
    if (!items.length) return <div style={text.caption}>Правок пока нет.</div>;
    return (
        <div style={{ display: 'grid', gap: 0 }}>
            {items.map((item) => (
                <div key={item.id} style={{ display: 'flex', gap: 12, padding: '10px 0', borderBottom: `1px solid ${t.border}`, fontSize: 13 }}>
                    <span style={{ color: t.textTertiary, whiteSpace: 'nowrap', minWidth: 110 }}>{formatShortDateTime(item.createdAt)}</span>
                    <span style={{ color: t.textPrimary, fontWeight: 600, whiteSpace: 'nowrap' }}>{item.staffName || 'Сотрудник'}</span>
                    <span style={{ color: t.textSecondary }}>{describeChange(item)}</span>
                </div>
            ))}
        </div>
    );
}

export default function PriceHistory({ roomTypes, initialId }: { roomTypes: RoomType[]; initialId?: number | null }) {
    const [id, setId] = useState<number | null>(initialId || roomTypes[0]?.id || null);
    const [period, setPeriod] = useState(30);
    const [operator, setOperator] = useState('');
    const [meal, setMeal] = useState('');
    const [items, setItems] = useState<PriceLogItem[]>([]);
    const [changes, setChanges] = useState<ChangeLogItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!id && roomTypes[0]) setId(roomTypes[0].id);
    }, [roomTypes, id]);

    useEffect(() => {
        if (!id) return;
        let cancelled = false;
        setLoading(true);
        setError(null);
        const from = period ? new Date(Date.now() - period * 86400000).toISOString() : undefined;
        Promise.all([getPriceLog(id, { from, limit: 500 }), getChangeLog(id, 100)])
            .then(([log, ch]) => {
                if (cancelled) return;
                setItems(log);
                setChanges(ch);
            })
            .catch((e: any) => {
                if (!cancelled) setError(e?.message || 'Не удалось загрузить историю');
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, [id, period]);

    const operators = useMemo(() => [...new Set(items.map((i) => i.operatorName).filter(Boolean))] as string[], [items]);
    const meals = useMemo(() => [...new Set(items.map((i) => i.meal).filter(Boolean))] as string[], [items]);
    const visible = items.filter((i) => (!operator || i.operatorName === operator) && (!meal || i.meal === meal));
    const current = roomTypes.find((rt) => rt.id === id);

    if (!roomTypes.length) return <Empty title="У отеля нет наших Room Type" hint="История цен появится после создания Room Type и первых показов на витрине" />;

    return (
        <div style={{ display: 'grid', gap: 16 }}>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                <select style={{ ...selectStyle, width: 300 }} value={id ?? ''} onChange={(e) => setId(Number(e.target.value))}>
                    {roomTypes.map((rt) => (
                        <option key={rt.id} value={rt.id}>{rt.content?.nameRu} · {rt.ruleLabel || ruleLabel(rt.rule)}</option>
                    ))}
                </select>
                <select style={{ ...selectStyle, width: 140 }} value={period} onChange={(e) => setPeriod(Number(e.target.value))}>
                    {PERIODS.map((p) => (
                        <option key={p.value} value={p.value}>{p.label}</option>
                    ))}
                </select>
                <select style={{ ...selectStyle, width: 180 }} value={operator} onChange={(e) => setOperator(e.target.value)}>
                    <option value="">Все операторы</option>
                    {operators.map((o) => (
                        <option key={o} value={o}>{o}</option>
                    ))}
                </select>
                <select style={{ ...selectStyle, width: 140 }} value={meal} onChange={(e) => setMeal(e.target.value)}>
                    <option value="">Всё питание</option>
                    {meals.map((m) => (
                        <option key={m} value={m}>{m}</option>
                    ))}
                </select>
            </div>

            <ErrorBox message={error} />
            {loading ? <Spinner label="Загружаем историю цен..." /> : null}

            {!loading && current ? (
                <>
                    <div style={{ ...cardStyle, padding: 20 }}>
                        <div style={{ ...text.cardTitle, marginBottom: 4 }}>{current.content?.nameRu}</div>
                        <div style={{ ...text.caption, marginBottom: 12 }}>
                            {current.hotelName} · правило {current.ruleLabel || ruleLabel(current.rule)} · {visible.length} записей
                        </div>
                        <PriceChart items={visible} />
                    </div>

                    {visible.length ? (
                        <TableWrap>
                            <table style={tableStyle}>
                                <thead>
                                    <tr>
                                        <th style={thStyle}>Дата</th>
                                        <th style={thStyle}>Оператор</th>
                                        <th style={thStyle}>Питание</th>
                                        <th style={thRight}>Цена LT</th>
                                        <th style={thRight}>Наша</th>
                                        <th style={thStyle}>Правило</th>
                                        <th style={thRight}>Маржа</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {visible.map((i) => (
                                        <tr key={i.id}>
                                            <td style={{ ...tdStyle, whiteSpace: 'nowrap' }}>{formatDateTime(i.seenAt)}</td>
                                            <td style={tdStyle}>{i.operatorName || '—'}</td>
                                            <td style={tdStyle}>{i.meal || '—'}</td>
                                            <td style={tdRight}>{formatMoney(i.providerPrice)}</td>
                                            <td style={{ ...tdRight, fontWeight: 600 }}>{formatMoney(i.finalPrice)}</td>
                                            <td style={{ ...tdStyle, whiteSpace: 'nowrap' }}>
                                                {snapshotLabel(i.rule)}
                                                {i.marginClamped ? <span style={{ marginLeft: 6 }}><StatusBadge label="ограничена" tone="error" /></span> : null}
                                            </td>
                                            <td style={{ ...tdRight, color: i.margin < 0 ? t.error : t.success }}>{formatMoney(i.margin, true)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </TableWrap>
                    ) : (
                        <Empty title="Записей за период нет" hint="Цена фиксируется при каждом показе Room Type на витрине (не чаще раза в час на оператора и питание)" />
                    )}

                    <div style={{ ...cardStyle, padding: 20 }}>
                        <div style={{ ...text.cardTitle, marginBottom: 8 }}>История правок</div>
                        <ChangeLogList items={changes} />
                    </div>
                </>
            ) : null}
            {!loading && !current && id ? (
                <div>
                    <button type="button" onClick={() => setId(roomTypes[0]?.id || null)} style={button('secondary', 'sm')}>Выбрать первый Room Type</button>
                </div>
            ) : null}
        </div>
    );
}
