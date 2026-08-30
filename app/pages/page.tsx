'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import PageShell from '@/components/PageShell';
import AdminNav from '@/components/AdminNav';
import Icon from '@/components/Icon';
import {
    FOOTER_PAGE_CATALOG,
    PUBLIC_SITE_URL,
    SECTION_LABELS,
} from '@/lib/footer-pages-catalog';
import { getAllCmsPages, hasPublishedContent, type CmsPage } from '@/lib/pages-api';
import { t, radius, text, cardStyle, inputStyle, button, badge } from '@/lib/theme';

export default function CmsPagesListPage() {
    const router = useRouter();
    const [pages, setPages] = useState<CmsPage[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');

    useEffect(() => {
        getAllCmsPages()
            .then(setPages)
            .catch((error) => {
                console.error(error);
                alert('Не удалось загрузить страницы из CMS');
            })
            .finally(() => setLoading(false));
    }, []);

    const pagesBySlug = useMemo(() => {
        const map: Record<string, CmsPage> = {};
        for (const page of pages) {
            if (page.slug) map[page.slug] = page;
        }
        return map;
    }, [pages]);

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return FOOTER_PAGE_CATALOG;
        return FOOTER_PAGE_CATALOG.filter((item) => {
            const haystack = [item.title, item.slug, item.group, item.breadcrumbLabel]
                .join(' ')
                .toLowerCase();
            return haystack.includes(q);
        });
    }, [search]);

    const publishedCount = FOOTER_PAGE_CATALOG.filter((item) =>
        hasPublishedContent(pagesBySlug[item.slug]),
    ).length;

    const grouped = useMemo(() => {
        const groups: Record<string, typeof FOOTER_PAGE_CATALOG> = {};
        for (const item of filtered) {
            if (!groups[item.group]) groups[item.group] = [];
            groups[item.group].push(item);
        }
        return groups;
    }, [filtered]);

    return (
        <PageShell>
            <AdminNav />

            <div style={cardStyle}>
                <div
                    style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start',
                        gap: 16,
                        flexWrap: 'wrap',
                        marginBottom: 24,
                    }}
                >
                    <div>
                        <h1 style={{ margin: 0, ...text.pageTitle }}>Страницы сайта</h1>
                        <p style={{ margin: '8px 0 0', ...text.body, color: t.textTertiary, maxWidth: 680 }}>
                            Редактируйте только страницы из футера сайта Totus Club (11 страниц). Изменения
                            появятся на сайте после сохранения.
                        </p>
                    </div>
                    <div style={badge('accent')}>
                        Опубликовано: {publishedCount} / {FOOTER_PAGE_CATALOG.length}
                    </div>
                </div>

                <div style={{ position: 'relative', marginBottom: 24 }}>
                    <span
                        aria-hidden
                        style={{
                            position: 'absolute',
                            left: 14,
                            top: '50%',
                            transform: 'translateY(-50%)',
                            color: t.textTertiary,
                            display: 'flex',
                        }}
                    >
                        <Icon name="search" size={18} />
                    </span>
                    <input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Поиск по названию или slug..."
                        style={{ ...inputStyle, paddingLeft: 42, outline: 'none' }}
                    />
                </div>

                {filtered.length === 0 ? (
                    <div style={{ ...text.caption, padding: 24 }}>Страницы не найдены</div>
                ) : (
                    Object.entries(grouped).map(([groupName, items]) => (
                        <div key={groupName} style={{ marginBottom: 28 }}>
                            <h2 style={{ margin: '0 0 14px', ...text.cardTitle }}>{groupName}</h2>
                            <div
                                style={{
                                    display: 'grid',
                                    gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                                    gap: 14,
                                }}
                            >
                                {items.map((item) => {
                                    const cmsPage = pagesBySlug[item.slug];
                                    const published = hasPublishedContent(cmsPage);
                                    return (
                                        <div
                                            key={item.slug}
                                            style={{
                                                padding: 18,
                                                borderRadius: radius.lg,
                                                border: `1px solid ${t.border}`,
                                                background: t.surfaceInset,
                                                display: 'flex',
                                                flexDirection: 'column',
                                                gap: 12,
                                            }}
                                        >
                                            <div>
                                                <div
                                                    style={{
                                                        display: 'flex',
                                                        justifyContent: 'space-between',
                                                        gap: 8,
                                                        alignItems: 'flex-start',
                                                    }}
                                                >
                                                    <div style={text.cardTitle}>{item.title}</div>
                                                    <span
                                                        style={{
                                                            ...badge(published ? 'success' : 'warning'),
                                                            whiteSpace: 'nowrap',
                                                        }}
                                                    >
                                                        {published ? 'Опубликовано' : 'Не опубликовано'}
                                                    </span>
                                                </div>
                                                <div style={{ ...text.caption, marginTop: 6 }}>
                                                    /{item.slug} · {SECTION_LABELS[item.section]}
                                                </div>
                                            </div>

                                            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                                <button
                                                    type="button"
                                                    onClick={() => router.push(`/pages/${item.slug}`)}
                                                    style={button('primary')}
                                                >
                                                    <Icon name="edit" size={16} />
                                                    Редактировать
                                                </button>
                                                <a
                                                    href={`${PUBLIC_SITE_URL}${item.publicPath}`}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    style={{ ...button('secondary'), textDecoration: 'none' }}
                                                >
                                                    <Icon name="linkExternal" size={16} />
                                                    Открыть на сайте
                                                </a>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ))
                )}
            </div>
        </PageShell>
    );
}
