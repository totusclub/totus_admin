'use client';

// Вкладка «Отели»: форма поиска Level.Travel → карточки отелей с числом наших Room Type.
// request_id хранится в state и в URL (?request_id=), чтобы возвращаться к той же выдаче без нового поиска.

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Icon from '@/components/Icon';
import { t, radius, text, cardStyle, button, badge } from '@/lib/theme';
import { Field, ErrorBox, compactInput, checkboxRow } from '@/components/notifications/shared';
import { searchHotels, hotelInfoOf, formatMoney, type HotelSearchItem, type HotelSearchResult } from '@/lib/rooms-api';
import StarsFilter, { parseStars, starsParam } from './StarsFilter';
import { Stars, RatingBadge, Thumb, Empty, Spinner, plural } from './shared';

/** Параметры поиска, которые живут в URL страницы и передаются на страницу отеля. */
export interface SearchForm {
    to_country: string;
    to_city: string;
    from_city: string;
    start_date: string;
    nights: string;
    adults: string;
    kids: string;
    /** Возраст детей через запятую → kids_ages. */
    kids_ages: string;
    stars: number[];
    q: string;
    only_ours: boolean;
}

const COUNTRY_HINTS: { code: string; name: string }[] = [
    { code: 'EG', name: 'Египет' },
    { code: 'TR', name: 'Турция' },
    { code: 'AE', name: 'ОАЭ' },
    { code: 'TH', name: 'Таиланд' },
    { code: 'RU', name: 'Россия' },
    { code: 'MV', name: 'Мальдивы' },
    { code: 'CY', name: 'Кипр' },
    { code: 'VN', name: 'Вьетнам' },
    { code: 'ID', name: 'Индонезия' },
    { code: 'GE', name: 'Грузия' },
];

function defaultStartDate(): string {
    const d = new Date();
    d.setDate(d.getDate() + 14);
    return d.toISOString().slice(0, 10);
}

export function formFromParams(sp: URLSearchParams): SearchForm {
    return {
        to_country: sp.get('to_country') || 'EG',
        to_city: sp.get('to_city') || '',
        from_city: sp.get('from_city') || 'Moscow',
        start_date: sp.get('start_date') || defaultStartDate(),
        nights: sp.get('nights') || '7',
        adults: sp.get('adults') || '2',
        kids: sp.get('kids') || '0',
        kids_ages: sp.get('kids_ages') || '',
        stars: parseStars(sp.get('stars')),
        q: sp.get('q') || '',
        only_ours: sp.get('only_ours') === '1',
    };
}

/** Возраста детей «7, 12» → «7,12»; пусто, если детей нет или возраста не заданы (LT требует kids_ages вместе с kids). */
export function kidsAges(form: Pick<SearchForm, 'kids' | 'kids_ages'>): string {
    if (!Number(form.kids)) return '';
    const ages = form.kids_ages.split(/[\s,;]+/).map((s) => Number(s)).filter((n) => Number.isInteger(n) && n >= 0 && n < 18);
    return ages.length ? ages.slice(0, Number(form.kids)).join(',') : '';
}

export function paramsFromForm(form: SearchForm, requestId?: string | null): URLSearchParams {
    const p = new URLSearchParams();
    p.set('tab', 'hotels');
    p.set('to_country', form.to_country.trim().toUpperCase());
    if (form.to_city.trim()) p.set('to_city', form.to_city.trim());
    p.set('from_city', form.from_city.trim() || 'Moscow');
    p.set('start_date', form.start_date);
    p.set('nights', form.nights || '7');
    p.set('adults', form.adults || '2');
    const ages = kidsAges(form);
    if (ages) {
        p.set('kids', String(ages.split(',').length));
        p.set('kids_ages', ages);
    }
    if (form.stars.length) p.set('stars', starsParam(form.stars));
    if (form.q.trim()) p.set('q', form.q.trim());
    if (form.only_ours) p.set('only_ours', '1');
    if (requestId) p.set('request_id', requestId);
    return p;
}

export default function HotelsTab({ initialParams }: { initialParams: URLSearchParams }) {
    const router = useRouter();
    const [form, setForm] = useState<SearchForm>(() => formFromParams(initialParams));
    const [requestId, setRequestId] = useState<string | null>(initialParams.get('request_id'));
    const [result, setResult] = useState<HotelSearchResult | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const autoRan = useRef(false);

    const set = <K extends keyof SearchForm>(key: K, value: SearchForm[K]) => setForm((f) => ({ ...f, [key]: value }));

    const run = useCallback(async (f: SearchForm, reuseRequestId: string | null) => {
        if (!f.to_country.trim()) {
            setError('Укажите страну (код ISO2, например EG)');
            return;
        }
        if (!f.start_date) {
            setError('Укажите дату заезда');
            return;
        }
        if (Number(f.kids) && !kidsAges(f)) {
            setError('Укажите возраст детей через запятую (например 7, 12) — Level.Travel требует его вместе с числом детей');
            return;
        }
        setLoading(true);
        setError(null);
        try {
            const data = await searchHotels({
                to_country: f.to_country.trim().toUpperCase(),
                to_city: f.to_city.trim() || undefined,
                from_city: f.from_city.trim() || 'Moscow',
                start_date: f.start_date,
                nights: f.nights || 7,
                adults: f.adults || 2,
                kids: kidsAges(f) ? String(kidsAges(f).split(',').length) : undefined,
                kids_ages: kidsAges(f) || undefined,
                stars: f.stars.length ? starsParam(f.stars) : undefined,
                q: f.q.trim() || undefined,
                only_ours: f.only_ours,
                request_id: reuseRequestId || undefined,
            });
            setResult(data);
            setRequestId(data.request_id);
            router.replace(`/rooms?${paramsFromForm(f, data.request_id).toString()}`);
        } catch (e: any) {
            setError(e?.message || 'Не удалось выполнить поиск');
        } finally {
            setLoading(false);
        }
    }, [router]);

    // Возврат на страницу с ?request_id — показываем ту же выдачу без нового поиска.
    useEffect(() => {
        if (autoRan.current) return;
        autoRan.current = true;
        if (requestId) run(form, requestId);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const openHotel = (item: HotelSearchItem) => {
        const info = hotelInfoOf(item);
        const p = paramsFromForm(form, requestId);
        p.delete('tab');
        p.set('name', info.name);
        p.set('hotel_stars', String(info.stars));
        p.set('city', info.city);
        router.push(`/rooms/hotel/${info.id}?${p.toString()}`);
    };

    const hotels = result?.hotels || [];
    const nights = Number(form.nights) || 0;

    return (
        <div style={{ display: 'grid', gap: 16 }}>
            <form
                onSubmit={(e) => {
                    e.preventDefault();
                    run(form, null);
                }}
                style={{ ...cardStyle, padding: 20, display: 'grid', gap: 14 }}
            >
                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(160px, 1fr) minmax(160px, 1fr) minmax(140px, 1fr) 150px 90px 90px 90px 130px', gap: 12 }}>
                    <Field label="Страна (ISO2)">
                        <input list="rooms-countries" style={compactInput} value={form.to_country} onChange={(e) => set('to_country', e.target.value)} placeholder="EG" maxLength={2} />
                        <datalist id="rooms-countries">
                            {COUNTRY_HINTS.map((c) => (
                                <option key={c.code} value={c.code}>{c.name}</option>
                            ))}
                        </datalist>
                    </Field>
                    <Field label="Курорт / город">
                        <input style={compactInput} value={form.to_city} onChange={(e) => set('to_city', e.target.value)} placeholder="Sharm El Sheikh" />
                    </Field>
                    <Field label="Город вылета">
                        <input style={compactInput} value={form.from_city} onChange={(e) => set('from_city', e.target.value)} placeholder="Moscow" />
                    </Field>
                    <Field label="Дата заезда">
                        <input type="date" style={compactInput} value={form.start_date} onChange={(e) => set('start_date', e.target.value)} />
                    </Field>
                    <Field label="Ночей">
                        <input type="number" min={1} max={30} style={compactInput} value={form.nights} onChange={(e) => set('nights', e.target.value)} />
                    </Field>
                    <Field label="Взрослых">
                        <input type="number" min={1} max={6} style={compactInput} value={form.adults} onChange={(e) => set('adults', e.target.value)} />
                    </Field>
                    <Field label="Детей">
                        <input type="number" min={0} max={4} style={compactInput} value={form.kids} onChange={(e) => set('kids', e.target.value)} />
                    </Field>
                    <Field label="Возраст детей">
                        <input style={compactInput} value={form.kids_ages} onChange={(e) => set('kids_ages', e.target.value)} placeholder="7, 12" disabled={!Number(form.kids)} />
                    </Field>
                </div>
                <div style={{ display: 'flex', gap: 16, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                    <Field label="Звёзды">
                        <StarsFilter value={form.stars} onChange={(v) => set('stars', v)} />
                    </Field>
                    <div style={{ flex: 1, minWidth: 220 }}>
                        <Field label="Название отеля">
                            <input style={compactInput} value={form.q} onChange={(e) => set('q', e.target.value)} placeholder="Например, Rixos" />
                        </Field>
                    </div>
                    <label style={{ ...checkboxRow, paddingBottom: 9 }}>
                        <input type="checkbox" checked={form.only_ours} onChange={(e) => set('only_ours', e.target.checked)} />
                        Только с нашими Room Type
                    </label>
                    <button type="submit" disabled={loading} style={{ ...button('primary', 'md'), opacity: loading ? 0.6 : 1 }}>
                        <Icon name="search" size={16} />
                        Найти
                    </button>
                </div>
            </form>

            <ErrorBox message={error} />

            {loading ? (
                <div style={{ ...cardStyle, padding: 20 }}>
                    <Spinner label="Запрашиваем цены у туроператоров… обычно 10–25 секунд" />
                </div>
            ) : null}

            {!loading && result ? (
                <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                        <div style={{ ...text.body, color: t.textPrimary }}>
                            {hotels.length
                                ? `Найдено ${hotels.length} ${plural(hotels.length, 'отель', 'отеля', 'отелей')}${form.to_city ? ` · ${form.to_city}` : ''}${form.stars.length ? ` · ${form.stars.join('/')}★` : ''}`
                                : 'Отели не найдены'}
                        </div>
                        <div style={text.caption}>
                            {result.ready_operators?.length ? `Операторов ответило: ${result.ready_operators.length}` : 'Операторы ещё отвечают'} · request_id {result.request_id}
                        </div>
                    </div>

                    {hotels.length === 0 ? (
                        <Empty title="Ничего не найдено" hint="Измените даты, звёзды или снимите фильтр «Только с нашими Room Type»" />
                    ) : (
                        <div style={{ display: 'grid', gap: 12 }}>
                            {hotels.map((item, i) => {
                                const info = hotelInfoOf(item);
                                const count = Number(item.totus_room_types) || 0;
                                return (
                                    <div key={`${info.id}-${i}`} style={{ ...cardStyle, padding: 16, display: 'flex', alignItems: 'center', gap: 16 }}>
                                        <Thumb src={info.image} width={120} height={90} />
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                                                <span style={{ ...text.cardTitle, fontSize: 17 }}>{info.name}</span>
                                                <Stars count={info.stars} />
                                            </div>
                                            <div style={{ ...text.body, marginTop: 4 }}>{info.city || '—'}</div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 6, flexWrap: 'wrap' }}>
                                                <RatingBadge value={info.rating} />
                                                {info.rating ? <span style={text.caption}>Рейтинг гостей</span> : null}
                                                {info.operators.length ? <span style={text.caption}>Операторы: {info.operators.join(' · ')}</span> : null}
                                            </div>
                                        </div>
                                        <div style={{ textAlign: 'right', display: 'grid', gap: 6, justifyItems: 'end' }}>
                                            <div style={{ fontSize: 16, fontWeight: 700, color: t.textPrimary, whiteSpace: 'nowrap' }}>
                                                {item.min_price ? `от ${formatMoney(Number(item.min_price))}` : 'Цена уточняется'}
                                                {item.min_price && nights ? <span style={{ fontWeight: 400, color: t.textSecondary }}> за {nights} {plural(nights, 'ночь', 'ночи', 'ночей')}</span> : null}
                                            </div>
                                            {count ? (
                                                <span style={badge('accent')}>{count} Room Type</span>
                                            ) : (
                                                <span style={badge('neutral')}>Нет наших Room Type</span>
                                            )}
                                        </div>
                                        <button type="button" onClick={() => openHotel(item)} style={{ ...button('secondary', 'md'), borderRadius: radius.pill }}>
                                            Открыть
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </>
            ) : null}

            {!loading && !result && !error ? (
                <Empty title="Найдите отель в выдаче Level.Travel" hint="Укажите страну, даты и туристов — цены запрашиваются у туроператоров по актуальному поиску" />
            ) : null}
        </div>
    );
}
