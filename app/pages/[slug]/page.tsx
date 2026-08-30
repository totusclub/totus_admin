'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import PageShell from '@/components/PageShell';
import AdminNav from '@/components/AdminNav';
import RichTextEditor from '@/components/RichTextEditor';
import Icon from '@/components/Icon';
import {
    FOOTER_PAGE_BY_SLUG,
    PUBLIC_SITE_URL,
    SECTION_LABELS,
    type FooterSection,
} from '@/lib/footer-pages-catalog';
import {
    getCmsPageBySlug,
    saveCmsPage,
    type SaveCmsPageInput,
} from '@/lib/pages-api';
import {
    t,
    text,
    cardStyle,
    inputStyle,
    textareaStyle,
    sectionBox,
    sectionTitle,
    button,
    badge,
} from '@/lib/theme';

const fieldLabel: React.CSSProperties = {
    display: 'block',
    marginBottom: 8,
    ...text.caption,
    color: t.textSecondary,
    fontWeight: 600,
};

const fieldInput: React.CSSProperties = {
    ...inputStyle,
    background: t.surfaceInset,
    outline: 'none',
    WebkitAppearance: 'none',
    appearance: 'none',
};

const SECTION_OPTIONS: FooterSection[] = ['company', 'contact', 'more', 'legal'];

export default function CmsPageEditorPage() {
    const params = useParams();
    const router = useRouter();
    const slug = String(params?.slug || '');

    const catalog = FOOTER_PAGE_BY_SLUG[slug];

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [savedAt, setSavedAt] = useState<string | null>(null);

    const [form, setForm] = useState<SaveCmsPageInput>({
        name: '',
        slug,
        seo_title: '',
        seo_desc: '',
        seo_keywords: '',
        section: 'company',
        breadcrumb_label: '',
        mobile_header_title: '',
        content: '',
    });

    useEffect(() => {
        if (!catalog) {
            setLoading(false);
            return;
        }

        const emptyForm: SaveCmsPageInput = {
            name: '',
            slug: catalog.slug,
            seo_title: '',
            seo_desc: '',
            seo_keywords: '',
            section: catalog.section,
            breadcrumb_label: '',
            mobile_header_title: '',
            content: '',
        };

        getCmsPageBySlug(slug)
            .then((page) => {
                if (!page) {
                    setForm(emptyForm);
                    return;
                }
                setForm({
                    id: page.id,
                    name: page.name || '',
                    slug: page.slug || catalog.slug,
                    seo_title: page.seo_title || '',
                    seo_desc: page.seo_desc || '',
                    seo_keywords: page.seo_keywords || '',
                    section: (page.section as FooterSection) || catalog.section,
                    breadcrumb_label: page.breadcrumb_label || '',
                    mobile_header_title: page.mobile_header_title || '',
                    content: page.content || '',
                });
            })
            .catch((error) => {
                console.error(error);
                setForm(emptyForm);
            })
            .finally(() => setLoading(false));
    }, [catalog, slug]);

    const sectionLabel = useMemo(() => {
        const section = form.section as FooterSection;
        return SECTION_LABELS[section] || section;
    }, [form.section]);

    const updateField = <K extends keyof SaveCmsPageInput>(key: K, value: SaveCmsPageInput[K]) => {
        setForm((prev) => ({ ...prev, [key]: value }));
    };

    const handleSave = async () => {
        if (!catalog) return;
        try {
            setSaving(true);
            const saved = await saveCmsPage(form);
            setForm((prev) => ({ ...prev, id: saved.id }));
            setSavedAt(new Date().toLocaleTimeString('ru-RU'));
        } catch (error) {
            console.error(error);
            alert('Не удалось сохранить страницу');
        } finally {
            setSaving(false);
        }
    };

    if (!catalog) {
        return (
            <PageShell>
                <AdminNav />
                <div style={cardStyle}>
                    <h1 style={{ margin: 0, ...text.pageTitle }}>Страница не найдена</h1>
                    <button
                        type="button"
                        onClick={() => router.push('/pages')}
                        style={{ ...button('primary'), marginTop: 16 }}
                    >
                        <Icon name="arrowLeft" size={16} />
                        Назад к списку
                    </button>
                </div>
            </PageShell>
        );
    }

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
                        <button
                            type="button"
                            onClick={() => router.push('/pages')}
                            style={{ ...button('tertiary', 'sm'), padding: 0, marginBottom: 8 }}
                        >
                            <Icon name="arrowLeft" size={16} />
                            Все страницы
                        </button>
                        <h1 style={{ margin: 0, ...text.pageTitle }}>{catalog.title}</h1>
                        <p style={{ margin: '8px 0 0', ...text.body, color: t.textTertiary }}>
                            /{slug} · {sectionLabel}
                        </p>
                    </div>

                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                        <a
                            href={`${PUBLIC_SITE_URL}${catalog.publicPath}`}
                            target="_blank"
                            rel="noreferrer"
                            style={{ ...button('secondary'), textDecoration: 'none' }}
                        >
                            <Icon name="linkExternal" size={16} />
                            Открыть на сайте
                        </a>
                        <button
                            type="button"
                            onClick={handleSave}
                            disabled={saving || loading}
                            style={{
                                ...button('primary'),
                                opacity: saving || loading ? 0.6 : 1,
                                cursor: saving || loading ? 'wait' : 'pointer',
                            }}
                        >
                            <Icon name="check" size={16} />
                            {saving ? 'Сохранение...' : 'Сохранить'}
                        </button>
                    </div>
                </div>

                {savedAt ? (
                    <div style={{ ...badge('success'), marginBottom: 18 }}>
                        <Icon name="check" size={14} />
                        Сохранено в {savedAt}
                    </div>
                ) : null}

                <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                    <div
                        style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                            gap: 14,
                        }}
                    >
                        <div>
                            <label style={fieldLabel}>Заголовок страницы (H1)</label>
                            <input
                                style={fieldInput}
                                value={form.name}
                                onChange={(e) => updateField('name', e.target.value)}
                            />
                        </div>
                        <div>
                            <label style={fieldLabel}>Хлебные крошки</label>
                            <input
                                style={fieldInput}
                                value={form.breadcrumb_label}
                                onChange={(e) => updateField('breadcrumb_label', e.target.value)}
                            />
                        </div>
                        <div>
                            <label style={fieldLabel}>Мобильный заголовок</label>
                            <input
                                style={fieldInput}
                                value={form.mobile_header_title}
                                onChange={(e) => updateField('mobile_header_title', e.target.value)}
                            />
                        </div>
                        <div>
                            <label style={fieldLabel}>Раздел</label>
                            <select
                                style={fieldInput}
                                value={form.section}
                                onChange={(e) =>
                                    updateField('section', e.target.value as FooterSection)
                                }
                            >
                                {SECTION_OPTIONS.map((section) => (
                                    <option key={section} value={section}>
                                        {SECTION_LABELS[section]}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div style={{ ...sectionBox, marginBottom: 0 }}>
                        <h3 style={{ ...sectionTitle, marginBottom: 16 }}>SEO настройки</h3>
                        <div style={{ display: 'grid', gap: 12 }}>
                            <div>
                                <label style={fieldLabel}>SEO заголовок</label>
                                <input
                                    style={fieldInput}
                                    value={form.seo_title}
                                    onChange={(e) => updateField('seo_title', e.target.value)}
                                />
                            </div>
                            <div>
                                <label style={fieldLabel}>SEO описание</label>
                                <textarea
                                    style={{
                                        ...textareaStyle,
                                        background: t.surfaceInset,
                                        outline: 'none',
                                    }}
                                    value={form.seo_desc}
                                    onChange={(e) => updateField('seo_desc', e.target.value)}
                                />
                            </div>
                            <div>
                                <label style={fieldLabel}>SEO ключевые слова</label>
                                <input
                                    style={fieldInput}
                                    value={form.seo_keywords}
                                    onChange={(e) => updateField('seo_keywords', e.target.value)}
                                />
                            </div>
                        </div>
                    </div>

                    <div>
                        <label style={fieldLabel}>Содержимое страницы</label>
                        <RichTextEditor
                            value={form.content}
                            onChange={(html) => updateField('content', html)}
                            placeholder="Напишите текст страницы. Можно использовать заголовки, списки, ссылки и изображения."
                        />
                    </div>
                </div>
            </div>
        </PageShell>
    );
}
