'use client';

import { useEffect, useRef, useState } from 'react';
import {
    addHeroImages,
    deleteHeroImage,
    getHomeBanners,
    getHomeHero,
    replaceHeroImage,
    saveHomeBanner,
    saveHomeHero,
    type HeroImage,
    type HomeBanner,
    type HomeHero,
} from '@/lib/home-banners-api';
import { badge, inputStyle, sectionBox, sectionDesc, sectionTitle, button, radius, text, t } from '@/lib/theme';
import Icon from '@/components/Icon';

const DEFAULT_TITLE = 'Путешествия начинаются здесь';
const HERO_ACCEPT = 'image/jpeg,image/png,image/webp';
const HERO_MAX_BYTES = 15 * 1024 * 1024;

function dropZoneStyle(preview: string, height: number): React.CSSProperties {
    return {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        height,
        borderRadius: radius.md,
        border: `1px dashed ${t.border}`,
        background: preview ? `center/cover url(${preview})` : t.surfaceInset,
        color: t.textTertiary,
        marginBottom: 12,
        boxSizing: 'border-box',
    };
}

/** Те же ограничения, что на сервере: JPG / PNG / WEBP, до 15 МБ. */
function validateHeroFiles(files: File[]): string | null {
    const wrongType = files.find((f) => !HERO_ACCEPT.split(',').includes(f.type));
    if (wrongType) return `«${wrongType.name}»: можно загружать только JPG, PNG или WEBP.`;
    const tooBig = files.find((f) => f.size > HERO_MAX_BYTES);
    if (tooBig) return `«${tooBig.name}»: файл больше 15 МБ.`;
    return null;
}

function HeroImageCard({
    item,
    index,
    busy,
    onReplace,
    onDelete,
}: {
    item: HeroImage;
    index: number;
    busy: boolean;
    onReplace: (file: File) => void;
    onDelete: () => void;
}) {
    const fileRef = useRef<HTMLInputElement>(null);

    return (
        <div
            style={{
                padding: 12,
                borderRadius: radius.md,
                border: `1px solid ${t.border}`,
                background: t.surface,
                opacity: busy ? 0.6 : 1,
                boxSizing: 'border-box',
            }}
        >
            <div
                style={{
                    width: '100%',
                    aspectRatio: '16 / 9',
                    borderRadius: radius.sm,
                    background: `center/cover no-repeat url(${item.image}), ${t.surfaceInset}`,
                    marginBottom: 10,
                }}
            />
            <p style={{ margin: '0 0 10px', ...text.caption }}>Изображение {index + 1}</p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <label style={{ ...button('secondary', 'sm'), cursor: busy ? 'default' : 'pointer' }}>
                    <Icon name="refresh" size={16} />
                    Заменить
                    <input
                        ref={fileRef}
                        type="file"
                        accept={HERO_ACCEPT}
                        disabled={busy}
                        style={{ display: 'none' }}
                        onChange={(e) => {
                            const next = e.target.files?.[0];
                            if (fileRef.current) fileRef.current.value = '';
                            if (next) onReplace(next);
                        }}
                    />
                </label>
                <button onClick={onDelete} disabled={busy} style={button('danger', 'sm')}>
                    <Icon name="delete" size={16} />
                    Удалить
                </button>
            </div>
        </div>
    );
}

function HeroBlock({ hero, onSaved }: { hero?: HomeHero; onSaved: (hero: HomeHero) => void }) {
    const [title, setTitle] = useState(hero?.title || DEFAULT_TITLE);
    const [savingTitle, setSavingTitle] = useState(false);
    const [images, setImages] = useState<HeroImage[]>(hero?.images || []);
    const [uploading, setUploading] = useState(false);
    const [busyId, setBusyId] = useState<number | null>(null);
    const addRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        setTitle(hero?.title || DEFAULT_TITLE);
    }, [hero?.title]);

    useEffect(() => {
        setImages(hero?.images || []);
    }, [hero?.images]);

    const handleSaveTitle = async () => {
        try {
            setSavingTitle(true);
            const saved = await saveHomeHero({ title });
            onSaved(saved);
        } catch (error) {
            alert(error instanceof Error ? error.message : 'Не удалось сохранить заголовок');
        } finally {
            setSavingTitle(false);
        }
    };

    const handleAdd = async (files: File[]) => {
        if (!files.length) return;
        const problem = validateHeroFiles(files);
        if (problem) {
            alert(problem);
            return;
        }
        try {
            setUploading(true);
            setImages(await addHeroImages(files));
        } catch (error) {
            alert(error instanceof Error ? error.message : 'Не удалось добавить изображения');
        } finally {
            setUploading(false);
        }
    };

    const handleReplace = async (item: HeroImage, file: File) => {
        const problem = validateHeroFiles([file]);
        if (problem) {
            alert(problem);
            return;
        }
        try {
            setBusyId(item.id);
            const updated = await replaceHeroImage(item.id, file);
            setImages((prev) => prev.map((img) => (img.id === item.id ? updated : img)));
        } catch (error) {
            alert(error instanceof Error ? error.message : 'Не удалось заменить изображение');
        } finally {
            setBusyId(null);
        }
    };

    const handleDelete = async (item: HeroImage) => {
        const last = images.length === 1;
        const question = last
            ? 'Это последнее изображение: hero на сайте останется без фона. Удалить?'
            : 'Удалить изображение?';
        if (!confirm(question)) return;
        try {
            setBusyId(item.id);
            await deleteHeroImage(item.id);
            setImages((prev) => prev.filter((img) => img.id !== item.id));
        } catch (error) {
            alert(error instanceof Error ? error.message : 'Не удалось удалить изображение');
        } finally {
            setBusyId(null);
        }
    };

    return (
        <div style={{ marginBottom: 20 }}>
            <h4 style={{ margin: '0 0 12px', ...text.cardTitle }}>Hero-блок</h4>

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
                <input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Заголовок hero"
                    style={{ ...inputStyle, flex: '1 1 320px', width: 'auto' }}
                />
                <button
                    onClick={handleSaveTitle}
                    disabled={savingTitle || !title.trim()}
                    style={{ ...button('primary'), opacity: savingTitle || !title.trim() ? 0.6 : 1 }}
                >
                    {savingTitle ? 'Сохранение...' : 'Сохранить заголовок'}
                </button>
            </div>

            <div
                style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    gap: 12,
                    flexWrap: 'wrap',
                    marginBottom: 12,
                }}
            >
                <div>
                    <p style={{ margin: '0 0 4px', ...text.cardTitle, display: 'flex', alignItems: 'center', gap: 8 }}>
                        Изображения
                        <span style={badge('neutral')}>Всего: {images.length}</span>
                    </p>
                    <p style={{ margin: 0, ...text.caption }}>
                        При каждом открытии главной показывается одно случайное изображение из списка.
                        Если изображение одно — показывается всегда. JPG, PNG или WEBP до 15 МБ.
                    </p>
                </div>
                <label style={{ ...button('primary', 'sm'), opacity: uploading ? 0.6 : 1, cursor: uploading ? 'default' : 'pointer' }}>
                    <Icon name="plus" size={16} />
                    {uploading ? 'Загрузка...' : 'Добавить изображения'}
                    <input
                        ref={addRef}
                        type="file"
                        accept={HERO_ACCEPT}
                        multiple
                        disabled={uploading}
                        style={{ display: 'none' }}
                        onChange={(e) => {
                            const files = Array.from(e.target.files || []);
                            if (addRef.current) addRef.current.value = '';
                            handleAdd(files);
                        }}
                    />
                </label>
            </div>

            {images.length === 0 ? (
                <div style={{ ...dropZoneStyle('', 140), flexDirection: 'column', gap: 8, marginBottom: 0 }}>
                    <Icon name="photo" size={28} />
                    <span style={text.caption}>Изображений пока нет — hero на сайте будет без фона.</span>
                </div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12 }}>
                    {images.map((item, index) => (
                        <HeroImageCard
                            key={item.id}
                            item={item}
                            index={index}
                            busy={busyId === item.id}
                            onReplace={(file) => handleReplace(item, file)}
                            onDelete={() => handleDelete(item)}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

type BannerTheme = 'light' | 'dark';

/** Картинка одной темы баннера: сохранённая, новый файл или «убрать». */
interface ThemeImageState {
    file: File | null;
    preview: string;
    remove: boolean;
}

const THEME_LABEL: Record<BannerTheme, string> = { light: 'Светлая тема', dark: 'Тёмная тема' };
const THEME_EMPTY: Record<BannerTheme, string> = {
    light: 'Не загружена — на сайте стандартная картинка',
    dark: 'Не загружена — в тёмной теме показывается светлая',
};

function savedImage(banner: HomeBanner | undefined, theme: BannerTheme): string {
    return (theme === 'light' ? banner?.image : banner?.image_dark) || '';
}

function BannerThemeImage({
    theme,
    state,
    saved,
    disabled,
    onPick,
    onClear,
}: {
    theme: BannerTheme;
    state: ThemeImageState;
    saved: string;
    disabled: boolean;
    onPick: (file: File) => void;
    onClear: () => void;
}) {
    const fileRef = useRef<HTMLInputElement>(null);
    const changed = Boolean(state.file) || state.remove;

    return (
        <div style={{ flex: '1 1 200px', minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
                <span style={{ ...text.cardTitle, fontSize: 14, lineHeight: '20px' }}>{THEME_LABEL[theme]}</span>
                {changed ? <span style={badge('warning')}>Не сохранено</span> : null}
            </div>
            <div
                style={{
                    ...dropZoneStyle(state.preview, 120),
                    flexDirection: 'column',
                    gap: 6,
                    padding: 12,
                    textAlign: 'center',
                    background: state.preview ? `center/cover no-repeat url(${state.preview}), ${t.surfaceInset}` : t.surfaceInset,
                }}
            >
                {!state.preview && (
                    <>
                        <Icon name="photo" size={24} />
                        <span style={{ ...text.caption, fontSize: 12 }}>{THEME_EMPTY[theme]}</span>
                    </>
                )}
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <label style={{ ...button('secondary', 'sm'), cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.6 : 1 }}>
                    <Icon name="upload" size={16} />
                    {state.preview ? 'Заменить' : 'Выбрать фото'}
                    <input
                        ref={fileRef}
                        type="file"
                        accept={HERO_ACCEPT}
                        disabled={disabled}
                        style={{ display: 'none' }}
                        onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (fileRef.current) fileRef.current.value = '';
                            if (file) onPick(file);
                        }}
                    />
                </label>
                {state.preview || (state.remove && saved) ? (
                    <button type="button" onClick={onClear} disabled={disabled} style={button('tertiary', 'sm')}>
                        <Icon name={state.remove ? 'refresh' : 'close'} size={16} />
                        {state.file && saved ? 'Вернуть прежнюю' : state.file ? 'Отменить' : state.remove ? 'Вернуть' : 'Убрать'}
                    </button>
                ) : null}
            </div>
        </div>
    );
}

function BannerSlot({ position, banner, onSaved }: { position: number; banner?: HomeBanner; onSaved: (b: HomeBanner) => void }) {
    const initialTheme = (theme: BannerTheme): ThemeImageState => ({ file: null, preview: savedImage(banner, theme), remove: false });
    const [url, setUrl] = useState(banner?.url || '');
    const [images, setImages] = useState<Record<BannerTheme, ThemeImageState>>({
        light: initialTheme('light'),
        dark: initialTheme('dark'),
    });
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        setUrl(banner?.url || '');
    }, [banner?.url]);

    useEffect(() => {
        setImages((prev) => ({
            light: prev.light.file || prev.light.remove ? prev.light : initialTheme('light'),
            dark: prev.dark.file || prev.dark.remove ? prev.dark : initialTheme('dark'),
        }));
    }, [banner?.image, banner?.image_dark]); // eslint-disable-line react-hooks/exhaustive-deps

    const pick = (theme: BannerTheme, file: File) => {
        const problem = validateHeroFiles([file]);
        if (problem) {
            alert(problem);
            return;
        }
        setImages((prev) => ({ ...prev, [theme]: { file, preview: URL.createObjectURL(file), remove: false } }));
    };

    // «Убрать» сохранённую картинку / отменить выбранный файл / вернуть убранную.
    const clear = (theme: BannerTheme) => {
        const saved = savedImage(banner, theme);
        setImages((prev) => {
            const cur = prev[theme];
            if (cur.file || cur.remove) return { ...prev, [theme]: { file: null, preview: saved, remove: false } };
            return { ...prev, [theme]: { file: null, preview: '', remove: Boolean(saved) } };
        });
    };

    const handleSave = async () => {
        try {
            setSaving(true);
            const saved = await saveHomeBanner(position, {
                url,
                image: images.light.file,
                imageDark: images.dark.file,
                removeImage: images.light.remove,
                removeImageDark: images.dark.remove,
            });
            onSaved(saved);
            setImages({
                light: { file: null, preview: saved.image || '', remove: false },
                dark: { file: null, preview: saved.image_dark || '', remove: false },
            });
        } catch (error) {
            alert(error instanceof Error ? error.message : 'Не удалось сохранить баннер');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div style={{ flex: '1 1 420px', minWidth: 260, padding: 16, borderRadius: radius.md, border: `1px solid ${t.border}`, background: t.surface, boxSizing: 'border-box' }}>
            <h4 style={{ margin: '0 0 12px', ...text.cardTitle }}>Баннер {position}</h4>
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 12 }}>
                {(['light', 'dark'] as BannerTheme[]).map((theme) => (
                    <BannerThemeImage
                        key={theme}
                        theme={theme}
                        state={images[theme]}
                        saved={savedImage(banner, theme)}
                        disabled={saving}
                        onPick={(file) => pick(theme, file)}
                        onClear={() => clear(theme)}
                    />
                ))}
            </div>
            <p style={{ margin: '0 0 12px', ...text.caption, fontSize: 12 }}>
                JPG, PNG или WEBP до 15 МБ. Сайт сам показывает картинку под тему, которую выбрал посетитель.
            </p>
            <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="Ссылка" style={{ ...inputStyle, marginBottom: 12 }} />
            <button onClick={handleSave} disabled={saving} style={{ ...button('primary'), opacity: saving ? 0.6 : 1 }}>
                {saving ? 'Сохранение...' : 'Сохранить'}
            </button>
        </div>
    );
}

export default function HeroBannersSection() {
    const [banners, setBanners] = useState<HomeBanner[]>([]);
    const [hero, setHero] = useState<HomeHero | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        Promise.all([getHomeBanners(), getHomeHero()])
            .then(([bannerData, heroData]) => {
                setBanners(bannerData);
                setHero(heroData);
            })
            .catch(() => alert('Не удалось загрузить баннеры'))
            .finally(() => setLoading(false));
    }, []);

    const handleSaved = (saved: HomeBanner) => {
        setBanners((prev) => {
            const exists = prev.some((b) => b.position === saved.position);
            if (exists) return prev.map((b) => (b.position === saved.position ? saved : b));
            return [...prev, saved].sort((a, b) => a.position - b.position);
        });
    };

    return (
        <section id="hero-banners" style={sectionBox}>
            <h3 style={sectionTitle}>Hero и баннеры</h3>
            <p style={sectionDesc}>Верхний блок и два баннера под поиском на главной. У каждого баннера — своя ссылка и свои картинки для светлой и тёмной темы.</p>
            {loading ? <p style={{ ...text.caption, margin: 0 }}>Загрузка...</p> : (
                <>
                    <HeroBlock hero={hero || undefined} onSaved={setHero} />
                    <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                        <BannerSlot position={1} banner={banners.find((b) => b.position === 1)} onSaved={handleSaved} />
                        <BannerSlot position={2} banner={banners.find((b) => b.position === 2)} onSaved={handleSaved} />
                    </div>
                </>
            )}
        </section>
    );
}
