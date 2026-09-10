'use client';

// Контент Room Type (шаг 2 мастера и секция редактора): поля, удобства-чипы, фотографии.

import { useState } from 'react';
import { text } from '@/lib/theme';
import { Field, compactInput } from '@/components/notifications/shared';
import { textareaStyle } from '@/lib/theme';
import { facilityName, type RoomImage, type RoomTypeContent } from '@/lib/rooms-api';
import PhotoPicker from './PhotoPicker';
import { Chip } from './shared';

const VIEW_HINTS = ['на море', 'на сад', 'на бассейн', 'на горы', 'на город', 'частичный вид на море'];

export default function ContentForm({ value, onChange, ltImages }: { value: RoomTypeContent; onChange: (next: RoomTypeContent) => void; ltImages: RoomImage[] }) {
    const [newFacility, setNewFacility] = useState('');
    const set = <K extends keyof RoomTypeContent>(key: K, v: RoomTypeContent[K]) => onChange({ ...value, [key]: v });

    const addFacility = () => {
        const name = newFacility.trim();
        if (!name) return;
        if (value.facilities.some((f) => facilityName(f).toLowerCase() === name.toLowerCase())) {
            setNewFacility('');
            return;
        }
        set('facilities', [...value.facilities, name]);
        setNewFacility('');
    };

    return (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.2fr) minmax(280px, 1fr)', gap: 24 }}>
            <div style={{ display: 'grid', gap: 14, alignContent: 'start' }}>
                <div style={{ ...text.caption, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Контент (предзаполнен из Level.Travel)</div>
                <Field label="Название RU">
                    <input style={compactInput} value={value.nameRu} onChange={(e) => set('nameRu', e.target.value)} maxLength={255} placeholder="Deluxe Sea View · Totus" />
                </Field>
                <Field label="Название EN">
                    <input style={compactInput} value={value.nameEn || ''} onChange={(e) => set('nameEn', e.target.value || null)} maxLength={255} />
                </Field>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1.4fr', gap: 12 }}>
                    <Field label="Размещение">
                        <input style={compactInput} value={value.accommodation || ''} onChange={(e) => set('accommodation', e.target.value || null)} maxLength={64} placeholder="2+1" />
                    </Field>
                    <Field label="Площадь, м²">
                        <input type="number" min={0} step={1} style={compactInput} value={value.area ?? ''} onChange={(e) => set('area', e.target.value === '' ? null : Number(e.target.value))} />
                    </Field>
                    <Field label="Вид">
                        <input list="rooms-view-hints" style={compactInput} value={value.view || ''} onChange={(e) => set('view', e.target.value || null)} maxLength={128} placeholder="на море" />
                        <datalist id="rooms-view-hints">
                            {VIEW_HINTS.map((v) => (
                                <option key={v} value={v} />
                            ))}
                        </datalist>
                    </Field>
                </div>
                <Field label="Описание">
                    <textarea style={{ ...textareaStyle, minHeight: 110, padding: '9px 12px' }} value={value.description || ''} onChange={(e) => set('description', e.target.value || null)} maxLength={8000} />
                </Field>
                <Field label="Удобства">
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                        {value.facilities.map((f, i) => (
                            <Chip key={`${facilityName(f)}-${i}`} active onRemove={() => set('facilities', value.facilities.filter((_, j) => j !== i))}>
                                {facilityName(f)}
                            </Chip>
                        ))}
                        <input
                            style={{ ...compactInput, width: 180, padding: '5px 10px' }}
                            value={newFacility}
                            onChange={(e) => setNewFacility(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    e.preventDefault();
                                    addFacility();
                                }
                            }}
                            onBlur={addFacility}
                            placeholder="+ Добавить (Enter)"
                            maxLength={120}
                        />
                    </div>
                </Field>
            </div>
            <div style={{ display: 'grid', gap: 12, alignContent: 'start' }}>
                <div style={{ ...text.caption, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Фотографии</div>
                <PhotoPicker ltImages={ltImages} value={value.images} onChange={(images) => set('images', images)} />
            </div>
        </div>
    );
}
