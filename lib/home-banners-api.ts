import { API_BASE_URL } from './server';

const BANNERS_API_BASE =
    process.env.NEXT_PUBLIC_CALLBACK_API_BASE ||
    process.env.NEXT_PUBLIC_PAGES_API_BASE ||
    API_BASE_URL;

export interface HomeBanner {
    id?: number;
    position: number;
    /** Картинка для светлой темы сайта ('' — не загружена: на сайте стандартная). */
    image: string;
    /** Картинка для тёмной темы ('' — не загружена: на сайте в тёмной теме светлая). */
    image_dark?: string;
    url: string;
    updated_at?: string;
}

async function parseJson<T>(response: Response): Promise<T> {
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
        throw new Error((data as any)?.message || `Request failed: ${response.status}`);
    }
    return data as T;
}

export async function getHomeBanners(): Promise<HomeBanner[]> {
    const response = await fetch(`${BANNERS_API_BASE}/api/admin/home-banners`, { cache: 'no-store' });
    const data = await parseJson<{ data: HomeBanner[] }>(response);
    return Array.isArray(data.data) ? data.data : [];
}

/**
 * Сохраняет один баннер (1 или 2); второй баннер не меняется.
 * image / imageDark — новая картинка для светлой / тёмной темы;
 * removeImage / removeImageDark — убрать загруженную картинку этой темы.
 */
export async function saveHomeBanner(
    position: number,
    input: {
        url: string;
        image?: File | null;
        imageDark?: File | null;
        removeImage?: boolean;
        removeImageDark?: boolean;
    },
): Promise<HomeBanner> {
    const formData = new FormData();
    formData.append('url', input.url ?? '');
    if (input.image) {
        formData.append('image', input.image);
    } else if (input.removeImage) {
        formData.append('remove_image', '1');
    }
    if (input.imageDark) {
        formData.append('image_dark', input.imageDark);
    } else if (input.removeImageDark) {
        formData.append('remove_image_dark', '1');
    }

    const response = await fetch(`${BANNERS_API_BASE}/api/admin/home-banners/${position}`, {
        method: 'PUT',
        body: formData,
    });
    const data = await parseJson<{ data: HomeBanner }>(response);
    return data.data;
}

/* ── Hero: заголовок + неограниченный список изображений ───────────────── */
// На сайте при каждом открытии главной показывается одно случайное изображение из списка
// (выбирает totus_API в GET /api/home-hero).

export interface HeroImage {
    id: number;
    image: string;
    sort_order: number;
    created_at?: string;
    updated_at?: string;
}

export interface HomeHero {
    id?: number;
    title: string;
    /** Первое изображение списка (совместимость со старым форматом). */
    image: string;
    images?: HeroImage[];
    updated_at?: string;
}

/** Сколько файлов можно отправить одним запросом (ограничение API; всего — без ограничения). */
export const HERO_MAX_FILES_PER_REQUEST = 20;

export async function getHomeHero(): Promise<HomeHero> {
    const response = await fetch(`${BANNERS_API_BASE}/api/admin/home-hero`, { cache: 'no-store' });
    const data = await parseJson<{ data: HomeHero }>(response);
    return data.data;
}

/** Сохраняет заголовок hero. Изображения управляются отдельными запросами ниже. */
export async function saveHomeHero(input: { title: string; image?: File | null }): Promise<HomeHero> {
    const formData = new FormData();
    formData.append('title', input.title);
    if (input.image) {
        formData.append('image', input.image);
    }

    const response = await fetch(`${BANNERS_API_BASE}/api/admin/home-hero`, {
        method: 'PUT',
        body: formData,
    });
    const data = await parseJson<{ data: HomeHero }>(response);
    return data.data;
}

export async function getHeroImages(): Promise<HeroImage[]> {
    const response = await fetch(`${BANNERS_API_BASE}/api/admin/home-hero/images`, { cache: 'no-store' });
    const data = await parseJson<{ data: HeroImage[] }>(response);
    return Array.isArray(data.data) ? data.data : [];
}

/** Добавляет изображения (любое количество — отправляются пачками). Возвращает весь список. */
export async function addHeroImages(files: File[]): Promise<HeroImage[]> {
    let images: HeroImage[] | null = null;
    for (let i = 0; i < files.length; i += HERO_MAX_FILES_PER_REQUEST) {
        const formData = new FormData();
        files.slice(i, i + HERO_MAX_FILES_PER_REQUEST).forEach((file) => formData.append('images', file));
        const response = await fetch(`${BANNERS_API_BASE}/api/admin/home-hero/images`, {
            method: 'POST',
            body: formData,
        });
        const data = await parseJson<{ data: HeroImage[]; images?: HeroImage[] }>(response);
        if (Array.isArray(data.images)) images = data.images;
    }
    return images ?? getHeroImages();
}

/** Заменяет файл изображения, id и место в списке сохраняются. */
export async function replaceHeroImage(id: number, file: File): Promise<HeroImage> {
    const formData = new FormData();
    formData.append('image', file);
    const response = await fetch(`${BANNERS_API_BASE}/api/admin/home-hero/images/${id}`, {
        method: 'PUT',
        body: formData,
    });
    const data = await parseJson<{ data: HeroImage }>(response);
    return data.data;
}

export async function deleteHeroImage(id: number): Promise<void> {
    const response = await fetch(`${BANNERS_API_BASE}/api/admin/home-hero/images/${id}`, {
        method: 'DELETE',
    });
    await parseJson(response);
}
