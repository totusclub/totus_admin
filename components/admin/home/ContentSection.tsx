'use client';

import { useEffect, useRef, useState } from 'react';
import {
    createHomeDestination,
    createHomeHotel,
    deleteHomeDestination,
    deleteHomeHotel,
    getHomeDestinations,
    getHomeHotels,
    getHomeSections,
    saveHomeSections,
    updateHomeDestination,
    updateHomeHotel,
    type HomePopularDestination,
    type HomeRecommendedHotel,
    type HomeSections,
} from '@/lib/home-content-api';
import { inputStyle, sectionBox, sectionDesc, sectionTitle, rowStyle, button, radius, text, t } from '@/lib/theme';
import Icon from '@/components/Icon';

function dropZoneStyle(preview: string): React.CSSProperties {
    return {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: 120,
        borderRadius: radius.md,
        border: `1px dashed ${t.border}`,
        background: preview ? `center/cover url(${preview})` : t.surfaceInset,
        color: t.textTertiary,
        boxSizing: 'border-box',
    };
}

const thumbStyle: React.CSSProperties = {
    width: 80,
    height: 60,
    borderRadius: radius.sm,
    flexShrink: 0,
};

export default function ContentSection() {
    const [sections, setSections] = useState<HomeSections | null>(null);
    const [hotels, setHotels] = useState<HomeRecommendedHotel[]>([]);
    const [destinations, setDestinations] = useState<HomePopularDestination[]>([]);
    const [loading, setLoading] = useState(true);
    const [savingSections, setSavingSections] = useState(false);

    useEffect(() => {
        Promise.all([getHomeSections(), getHomeHotels(), getHomeDestinations()])
            .then(([sectionsData, hotelsData, destinationsData]) => {
                setSections(sectionsData);
                setHotels(hotelsData);
                setDestinations(destinationsData);
            })
            .catch(() => alert('Не удалось загрузить контент'))
            .finally(() => setLoading(false));
    }, []);

    const handleSaveSections = async () => {
        if (!sections) return;
        try {
            setSavingSections(true);
            const saved = await saveHomeSections({
                recommended_title: sections.recommended_title,
                destinations_title: sections.destinations_title,
            });
            setSections(saved);
        } catch (error) {
            alert(error instanceof Error ? error.message : 'Не удалось сохранить заголовки');
        } finally {
            setSavingSections(false);
        }
    };

    if (loading) {
        return <section style={sectionBox}><p style={{ ...text.caption, margin: 0 }}>Загрузка контента...</p></section>;
    }

    return (
        <>
            <section id="titles" style={sectionBox}>
                <h3 style={sectionTitle}>Заголовки секций</h3>
                <p style={sectionDesc}>Тексты над блоками отелей и направлений.</p>
                <div style={{ display: 'grid', gap: 12, marginBottom: 14 }}>
                    <input value={sections?.recommended_title || ''} onChange={(e) => setSections((prev) => prev ? { ...prev, recommended_title: e.target.value } : prev)} placeholder="Начните планирование путешествия здесь" style={inputStyle} />
                    <input value={sections?.destinations_title || ''} onChange={(e) => setSections((prev) => prev ? { ...prev, destinations_title: e.target.value } : prev)} placeholder="Популярные направления" style={inputStyle} />
                </div>
                <button onClick={handleSaveSections} disabled={savingSections} style={{ ...button('primary'), opacity: savingSections ? 0.6 : 1 }}>
                    {savingSections ? 'Сохранение...' : 'Сохранить заголовки'}
                </button>
            </section>

            <HotelsSection hotels={hotels} onChange={setHotels} />
            <DestinationsSection destinations={destinations} onChange={setDestinations} />
        </>
    );
}

function HotelsSection({ hotels, onChange }: { hotels: HomeRecommendedHotel[]; onChange: (hotels: HomeRecommendedHotel[]) => void }) {
    const [showCreate, setShowCreate] = useState(false);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [hotelId, setHotelId] = useState('0');
    const [name, setName] = useState('');
    const [city, setCity] = useState('');
    const [rate, setRate] = useState('5');
    const [sortOrder, setSortOrder] = useState('0');
    const [imageUrl, setImageUrl] = useState('');
    const [file, setFile] = useState<File | null>(null);
    const [preview, setPreview] = useState('');
    const [saving, setSaving] = useState(false);
    const fileRef = useRef<HTMLInputElement>(null);

    const resetForm = () => {
        setHotelId('0');
        setName('');
        setCity('');
        setRate('5');
        setSortOrder(String(hotels.length + 1));
        setImageUrl('');
        setFile(null);
        setPreview('');
        if (fileRef.current) fileRef.current.value = '';
    };

    const startEdit = (hotel: HomeRecommendedHotel) => {
        setEditingId(hotel.id);
        setHotelId(String(hotel.hotel_id));
        setName(hotel.name);
        setCity(hotel.city);
        setRate(String(hotel.rate));
        setSortOrder(String(hotel.sort_order));
        setImageUrl(hotel.image);
        setPreview(hotel.image);
        setFile(null);
        setShowCreate(false);
    };

    const handleSave = async () => {
        try {
            setSaving(true);
            const payload = {
                hotel_id: Number(hotelId) || 0,
                name,
                city,
                rate: Number(rate) || 5,
                price: 0,
                review: 0,
                sort_order: Number(sortOrder) || 0,
                image: file,
                imageUrl: file ? undefined : imageUrl,
            };
            if (editingId) {
                const saved = await updateHomeHotel(editingId, payload);
                onChange(hotels.map((h) => (h.id === editingId ? saved : h)));
                setEditingId(null);
            } else {
                const saved = await createHomeHotel(payload);
                onChange([...hotels, saved].sort((a, b) => a.sort_order - b.sort_order));
                setShowCreate(false);
            }
            resetForm();
        } catch (error) {
            alert(error instanceof Error ? error.message : 'Не удалось сохранить отель');
        } finally {
            setSaving(false);
        }
    };

    return (
        <section id="hotels" style={sectionBox}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 14 }}>
                <div>
                    <h3 style={sectionTitle}>Рекомендуемые отели</h3>
                    <p style={{ ...sectionDesc, marginBottom: 0 }}>Блок «Начните планирование путешествия здесь».</p>
                </div>
                <button onClick={() => { setShowCreate((v) => !v); setEditingId(null); resetForm(); }} style={{ ...button('primary', 'sm'), height: 'fit-content' }}>
                    <Icon name={showCreate ? 'close' : 'plus'} size={16} />
                    {showCreate ? 'Скрыть' : 'Добавить'}
                </button>
            </div>
            {(showCreate || editingId) && (
                <div style={{ display: 'grid', gap: 10, marginBottom: 16 }}>
                    <div style={dropZoneStyle(preview)}>
                        {!preview && <Icon name="photo" size={28} />}
                    </div>
                    <label style={{ ...button('secondary'), width: 'fit-content' }}>
                        <Icon name="upload" size={16} />
                        Выбрать фото
                        <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => {
                            const next = e.target.files?.[0] || null;
                            if (!next) return;
                            setFile(next);
                            setPreview(URL.createObjectURL(next));
                        }} />
                    </label>
                    <input value={hotelId} onChange={(e) => setHotelId(e.target.value)} placeholder="ID отеля (Level Travel)" style={inputStyle} />
                    <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Название" style={inputStyle} />
                    <input value={city} onChange={(e) => setCity(e.target.value)} placeholder="Город" style={inputStyle} />
                    <input value={imageUrl} onChange={(e) => { setImageUrl(e.target.value); setPreview(e.target.value); }} placeholder="URL изображения (если без загрузки)" style={inputStyle} />
                    <input value={rate} onChange={(e) => setRate(e.target.value)} placeholder="Рейтинг" style={inputStyle} />
                    <input value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} placeholder="Порядок" style={inputStyle} />
                    <button onClick={handleSave} disabled={saving} style={{ ...button('primary'), width: 'fit-content', opacity: saving ? 0.6 : 1 }}>{saving ? 'Сохранение...' : editingId ? 'Сохранить' : 'Добавить'}</button>
                </div>
            )}
            <div style={{ display: 'grid', gap: 12 }}>
                {hotels.map((hotel) => (
                    <div key={hotel.id} style={{ ...rowStyle, gap: 14, flexWrap: 'wrap' }}>
                        <div style={{ ...thumbStyle, background: `center/cover url(${hotel.image})` }} />
                        <div style={{ flex: 1, minWidth: 180 }}>
                            <p style={{ margin: 0, ...text.cardTitle }}>{hotel.name}</p>
                            <p style={{ margin: '4px 0 0', ...text.caption }}>{hotel.city} · ID {hotel.hotel_id}</p>
                        </div>
                        <button onClick={() => startEdit(hotel)} style={button('secondary', 'sm')}>
                            <Icon name="edit" size={16} />
                            Изменить
                        </button>
                        <button onClick={async () => { if (!confirm(`Удалить «${hotel.name}»?`)) return; await deleteHomeHotel(hotel.id); onChange(hotels.filter((h) => h.id !== hotel.id)); }} style={button('danger', 'sm')}>
                            <Icon name="delete" size={16} />
                            Удалить
                        </button>
                    </div>
                ))}
            </div>
        </section>
    );
}

function DestinationsSection({ destinations, onChange }: { destinations: HomePopularDestination[]; onChange: (destinations: HomePopularDestination[]) => void }) {
    const [showCreate, setShowCreate] = useState(false);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [name, setName] = useState('');
    const [toCountry, setToCountry] = useState('');
    const [sortOrder, setSortOrder] = useState('0');
    const [imageUrl, setImageUrl] = useState('');
    const [file, setFile] = useState<File | null>(null);
    const [preview, setPreview] = useState('');
    const [saving, setSaving] = useState(false);
    const fileRef = useRef<HTMLInputElement>(null);

    const resetForm = () => {
        setName(''); setToCountry(''); setSortOrder(String(destinations.length + 1)); setImageUrl(''); setFile(null); setPreview('');
        if (fileRef.current) fileRef.current.value = '';
    };

    const handleSave = async () => {
        try {
            setSaving(true);
            const payload = { name, to_country: toCountry, sort_order: Number(sortOrder) || 0, image: file, imageUrl: file ? undefined : imageUrl };
            if (editingId) {
                const saved = await updateHomeDestination(editingId, payload);
                onChange(destinations.map((d) => (d.id === editingId ? saved : d)));
                setEditingId(null);
            } else {
                const saved = await createHomeDestination(payload);
                onChange([...destinations, saved].sort((a, b) => a.sort_order - b.sort_order));
                setShowCreate(false);
            }
            resetForm();
        } catch (error) {
            alert(error instanceof Error ? error.message : 'Не удалось сохранить направление');
        } finally {
            setSaving(false);
        }
    };

    return (
        <section id="destinations" style={sectionBox}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 14 }}>
                <div>
                    <h3 style={sectionTitle}>Популярные направления</h3>
                    <p style={{ ...sectionDesc, marginBottom: 0 }}>Карточки направлений на главной.</p>
                </div>
                <button onClick={() => { setShowCreate((v) => !v); setEditingId(null); resetForm(); }} style={{ ...button('primary', 'sm'), height: 'fit-content' }}>
                    <Icon name={showCreate ? 'close' : 'plus'} size={16} />
                    {showCreate ? 'Скрыть' : 'Добавить'}
                </button>
            </div>
            {(showCreate || editingId) && (
                <div style={{ display: 'grid', gap: 10, marginBottom: 16 }}>
                    <div style={dropZoneStyle(preview)}>
                        {!preview && <Icon name="photo" size={28} />}
                    </div>
                    <label style={{ ...button('secondary'), width: 'fit-content' }}>
                        <Icon name="upload" size={16} />
                        Выбрать фото
                        <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => { const next = e.target.files?.[0] || null; if (!next) return; setFile(next); setPreview(URL.createObjectURL(next)); }} />
                    </label>
                    <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Название" style={inputStyle} />
                    <input value={toCountry} onChange={(e) => setToCountry(e.target.value)} placeholder="Код страны (EG, TR...)" style={inputStyle} />
                    <input value={imageUrl} onChange={(e) => { setImageUrl(e.target.value); setPreview(e.target.value); }} placeholder="URL изображения" style={inputStyle} />
                    <input value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} placeholder="Порядок" style={inputStyle} />
                    <button onClick={handleSave} disabled={saving} style={{ ...button('primary'), width: 'fit-content', opacity: saving ? 0.6 : 1 }}>{saving ? 'Сохранение...' : editingId ? 'Сохранить' : 'Добавить'}</button>
                </div>
            )}
            <div style={{ display: 'grid', gap: 12 }}>
                {destinations.map((item) => (
                    <div key={item.id} style={{ ...rowStyle, gap: 14, flexWrap: 'wrap' }}>
                        <div style={{ ...thumbStyle, background: `center/cover url(${item.image})` }} />
                        <div style={{ flex: 1, minWidth: 180 }}>
                            <p style={{ margin: 0, ...text.cardTitle }}>{item.name}</p>
                            <p style={{ margin: '4px 0 0', ...text.caption }}>{item.to_country}</p>
                        </div>
                        <button onClick={() => { setEditingId(item.id); setName(item.name); setToCountry(item.to_country); setSortOrder(String(item.sort_order)); setImageUrl(item.image); setPreview(item.image); setFile(null); setShowCreate(false); }} style={button('secondary', 'sm')}>
                            <Icon name="edit" size={16} />
                            Изменить
                        </button>
                        <button onClick={async () => { if (!confirm(`Удалить «${item.name}»?`)) return; await deleteHomeDestination(item.id); onChange(destinations.filter((d) => d.id !== item.id)); }} style={button('danger', 'sm')}>
                            <Icon name="delete" size={16} />
                            Удалить
                        </button>
                    </div>
                ))}
            </div>
        </section>
    );
}
