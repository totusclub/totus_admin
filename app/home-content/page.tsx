'use client';

import { useEffect } from 'react';
import PageShell from '@/components/PageShell';
import AdminNav from '@/components/AdminNav';
import HeroBannersSection from '@/components/admin/home/HeroBannersSection';
import ContentSection from '@/components/admin/home/ContentSection';
import PartnersSection from '@/components/admin/home/PartnersSection';
import FaqSection from '@/components/admin/home/FaqSection';
import FooterSocialSection from '@/components/admin/home/FooterSocialSection';
import { button, radius, t } from '@/lib/theme';
import { PageHeader, pageCard } from '@/components/PageKit';

const NAV_ITEMS = [
    { id: 'hero-banners', label: 'Hero и баннеры' },
    { id: 'titles', label: 'Заголовки' },
    { id: 'hotels', label: 'Отели' },
    { id: 'destinations', label: 'Направления' },
    { id: 'partners', label: 'Партнёры' },
    { id: 'faq', label: 'FAQ' },
    { id: 'footer-social', label: 'Соцсети' },
];

export default function HomeContentPage() {
    useEffect(() => {
        const hash = window.location.hash.replace('#', '');
        if (!hash) return;
        const el = document.getElementById(hash);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, []);

    const scrollTo = (id: string) => {
        const el = document.getElementById(id);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        window.history.replaceState(null, '', `#${id}`);
    };

    return (
        <PageShell>
            <AdminNav />

            <div style={pageCard}>
                <PageHeader
                    title="Главная страница"
                    subtitle="Все секции главной страницы сайта в одном месте — в том же порядке, что на сайте."
                />

                <div
                    style={{
                        display: 'flex',
                        gap: 8,
                        flexWrap: 'wrap',
                        padding: 12,
                        borderRadius: radius.md,
                        border: `1px solid ${t.border}`,
                        background: t.surfaceInset,
                    }}
                >
                    {NAV_ITEMS.map((item) => (
                        <button
                            key={item.id}
                            onClick={() => scrollTo(item.id)}
                            style={{ ...button('secondary', 'sm'), borderRadius: radius.pill }}
                        >
                            {item.label}
                        </button>
                    ))}
                </div>

                <div style={{ minWidth: 0 }}>
                    <HeroBannersSection />
                    <ContentSection />
                    <PartnersSection />
                    <FaqSection />
                    <FooterSocialSection />
                </div>
            </div>
        </PageShell>
    );
}
