'use client';

// Фотографии Room Type: «Фото Level.Travel (N)» — выбор, какие оставить; «Свои фотографии» — загрузка
// через POST /images (multipart) → `{source:'upload', url}`. Первое фото в `value` — главное на витрине.

import { useRef, useState } from 'react';
import Icon from '@/components/Icon';
import { t, radius, text, button } from '@/lib/theme';
import { ErrorBox } from '@/components/notifications/shared';
import { uploadRoomImage, deleteRoomImage, imageUrl, type RoomImage } from '@/lib/rooms-api';
import { Segment } from './shared';

const ACCEPT = 'image/jpeg,image/png,image/webp';
const MAX_BYTES = 15 * 1024 * 1024;

function Tile({ image, selected, main, onToggle, onMain, onRemove }: { image: RoomImage; selected: boolean; main: boolean; onToggle?: () => void; onMain?: () => void; onRemove?: () => void }) {
    return (
        <div
            style={{
                position: 'relative',
                aspectRatio: '4 / 3',
                borderRadius: radius.sm,
                overflow: 'hidden',
                border: `2px solid ${selected ? t.accent : t.border}`,
                background: t.surfaceInset,
                cursor: onToggle ? 'pointer' : 'default',
                opacity: selected ? 1 : 0.55,
            }}
            onClick={onToggle}
        >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={imageUrl(image.url)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
            {onToggle ? (
                <span
                    aria-hidden
                    style={{
                        position: 'absolute',
                        top: 6,
                        right: 6,
                        width: 22,
                        height: 22,
                        borderRadius: radius.pill,
                        background: selected ? t.accent : 'rgba(255,255,255,0.9)',
                        color: selected ? t.textOnAccent : t.textTertiary,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                    }}
                >
                    <Icon name="check" size={14} />
                </span>
            ) : null}
            {onRemove ? (
                <button
                    type="button"
                    onClick={(e) => {
                        e.stopPropagation();
                        onRemove();
                    }}
                    aria-label="Удалить фото"
                    style={{ position: 'absolute', top: 6, right: 6, width: 22, height: 22, borderRadius: radius.pill, border: 'none', background: 'rgba(0,0,0,0.6)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0 }}
                >
                    <Icon name="close" size={14} />
                </button>
            ) : null}
            {main ? (
                <span style={{ position: 'absolute', left: 6, bottom: 6, padding: '2px 8px', borderRadius: radius.sm, background: 'rgba(0,0,0,0.7)', color: '#fff', fontSize: 11, fontWeight: 600 }}>
                    Главное
                </span>
            ) : selected && onMain ? (
                <button
                    type="button"
                    onClick={(e) => {
                        e.stopPropagation();
                        onMain();
                    }}
                    style={{ position: 'absolute', left: 6, bottom: 6, padding: '2px 8px', borderRadius: radius.sm, border: 'none', background: 'rgba(255,255,255,0.9)', color: t.textSecondary, fontSize: 11, fontWeight: 600, cursor: 'pointer' }}
                >
                    Сделать главным
                </button>
            ) : null}
        </div>
    );
}

export default function PhotoPicker({ ltImages, value, onChange }: { ltImages: RoomImage[]; value: RoomImage[]; onChange: (next: RoomImage[]) => void }) {
    const [mode, setMode] = useState<'lt' | 'upload'>(ltImages.length ? 'lt' : 'upload');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const fileRef = useRef<HTMLInputElement>(null);

    const has = (url: string) => value.some((im) => im.url === url);
    const uploads = value.filter((im) => im.source === 'upload');
    const mainUrl = value[0]?.url;

    const toggleLt = (image: RoomImage) => {
        if (has(image.url)) onChange(value.filter((im) => im.url !== image.url));
        else {
            // сохраняем порядок LT среди LT-фото, свои — в конце
            const lt = ltImages.filter((im) => has(im.url) || im.url === image.url);
            onChange([...lt, ...uploads]);
        }
    };

    const makeMain = (url: string) => {
        const target = value.find((im) => im.url === url);
        if (!target) return;
        onChange([target, ...value.filter((im) => im.url !== url)]);
    };

    const removeUpload = async (image: RoomImage) => {
        onChange(value.filter((im) => im.url !== image.url));
        try {
            await deleteRoomImage(image.url);
        } catch {
            // файл мог быть уже удалён — на витрину не влияет
        }
    };

    const onFiles = async (files: FileList | null) => {
        if (!files || !files.length) return;
        setError(null);
        setBusy(true);
        const added: RoomImage[] = [];
        try {
            for (const file of Array.from(files)) {
                if (!ACCEPT.split(',').includes(file.type)) throw new Error(`«${file.name}»: допустимы только JPEG, PNG или WebP`);
                if (file.size > MAX_BYTES) throw new Error(`«${file.name}»: файл больше 15 МБ`);
                added.push(await uploadRoomImage(file));
            }
        } catch (e: any) {
            setError(e?.message || 'Не удалось загрузить фото');
        } finally {
            setBusy(false);
            if (added.length) onChange([...value, ...added]);
            if (fileRef.current) fileRef.current.value = '';
        }
    };

    return (
        <div style={{ display: 'grid', gap: 12 }}>
            <Segment<'lt' | 'upload'>
                fullWidth
                options={[
                    { value: 'lt', label: `Фото Level.Travel (${ltImages.length})` },
                    { value: 'upload', label: `Свои фотографии${uploads.length ? ` (${uploads.length})` : ''}` },
                ]}
                value={mode}
                onChange={setMode}
            />

            {mode === 'lt' ? (
                ltImages.length ? (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                        {ltImages.map((im) => (
                            <Tile key={im.url} image={im} selected={has(im.url)} main={mainUrl === im.url} onToggle={() => toggleLt(im)} onMain={() => makeMain(im.url)} />
                        ))}
                    </div>
                ) : (
                    <div style={text.caption}>У номера-источника нет фотографий Level.Travel.</div>
                )
            ) : (
                <div style={{ display: 'grid', gap: 10 }}>
                    {uploads.length ? (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                            {uploads.map((im) => (
                                <Tile key={im.url} image={im} selected main={mainUrl === im.url} onMain={() => makeMain(im.url)} onRemove={() => removeUpload(im)} />
                            ))}
                        </div>
                    ) : (
                        <div style={text.caption}>Своих фотографий пока нет.</div>
                    )}
                </div>
            )}

            <input ref={fileRef} type="file" accept={ACCEPT} multiple hidden onChange={(e) => onFiles(e.target.files)} />
            <button type="button" onClick={() => fileRef.current?.click()} disabled={busy} style={{ ...button('secondary', 'md'), width: '100%', opacity: busy ? 0.6 : 1 }}>
                <Icon name="upload" size={16} />
                {busy ? 'Загружаем...' : 'Загрузить свои'}
            </button>
            <ErrorBox message={error} />
            <div style={text.caption}>
                Можно использовать фото Level.Travel, заменить их или добавить свои (JPEG/PNG/WebP до 15 МБ). Первое фото — главное на витрине.
                Выбрано: {value.length}.
            </div>
        </div>
    );
}
