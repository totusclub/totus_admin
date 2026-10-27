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
import { t, radius, text, button, badge } from '@/lib/theme';
import { PageHeader, Toolbar, SearchInput, pageCard, emptyTextStyle } from '@/components/PageKit';

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

            <div style={pageCard}>
                <PageHeader
                    title="Страницы сайта"
                    subtitle="Редактируйте только страницы из футера сайта Totus Club (11 страниц). Изменения появятся на сайте после сохранения."
                    actions={
                        <span style={badge('accent')}>
                            Опубликовано: {publishedCount} / {FOOTER_PAGE_CATALOG.length}
                        </span>
                    }
                />

                <Toolbar>
                    <SearchInput value={search} onChange={setSearch} placeholder="Поиск по названию или slug..." />
                </Toolbar>

                {filtered.length === 0 ? (
                    <div style={emptyTextStyle}>Страницы не найдены</div>
                ) : (
                    Object.entries(grouped).map(([groupName, items]) => (
                        <div key={groupName} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                            <h2 style={{ margin: 0, ...text.cardTitle }}>{groupName}</h2>
                            <div
                                style={{
                                    display: 'grid',
                                    gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                                    gap: 12,
                                }}
                            >
                                {items.map((item) => {
                                    const cmsPage = pagesBySlug[item.slug];
                                    const published = hasPublishedContent(cmsPage);
                                    return (
                                        <div
                                            key={item.slug}
                                            style={{
                                                padding: '16px 20px',
                                                borderRadius: radius.md,
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
