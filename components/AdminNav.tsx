'use client';

import { usePathname, useRouter } from 'next/navigation';

type NavLink = {
    href: string;
    label: string;
    icon: string;
    /** External links open in a new tab and are never highlighted as active. */
    external?: boolean;
};

const LINKS: NavLink[] = [
    { href: '/users', label: 'Пользователи', icon: '👥' },
    { href: '/orders', label: 'Заказы', icon: '🧳' },
    { href: '/lt-orders', label: 'Level Travel', icon: '🌍' },
    { href: '/order-requests', label: 'Обращения', icon: '📨' },
    { href: '/pages', label: 'Страницы', icon: '📄' },
    { href: '/home-content', label: 'Главная', icon: '🏠' },
    { href: '/callback-requests', label: 'Заявки на звонок', icon: '📱' },
    // The calling panel lives in a separate app (calling_v2).
    { href: 'https://calling.totus.club', label: 'Звонки', icon: '📞', external: true },
];

export default function AdminNav() {
    const pathname = usePathname();
    const router = useRouter();

    const isActive = (link: NavLink) => {
        if (link.external) return false;
        if (link.href === '/') return pathname === '/';
        return pathname === link.href || pathname.startsWith(`${link.href}/`);
    };

    const navigate = (link: NavLink) => {
        if (link.external) {
            window.open(link.href, '_blank', 'noopener,noreferrer');
            return;
        }
        router.push(link.href);
    };

    return (
        <div
            style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: 8,
                borderRadius: 999,
                background: 'linear-gradient(135deg, rgba(15,23,42,0.95), rgba(2,6,23,0.95))',
                border: '1px solid rgba(55,65,81,0.6)',
                boxShadow: '0 12px 40px rgba(0,0,0,0.4)',
                backdropFilter: 'blur(20px)',
                width: 'fit-content',
            }}
        >
            {LINKS.map((link) => {
                const active = isActive(link);
                return (
                    <button
                        key={link.href}
                        onClick={() => navigate(link)}
                        title={link.external ? 'Откроется в новой вкладке' : undefined}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            padding: '10px 18px',
                            borderRadius: 999,
                            border: 'none',
                            cursor: 'pointer',
                            fontSize: 14,
                            fontWeight: 600,
                            color: active ? '#f9fafb' : '#9ca3af',
                            background: active ? '#FE732E' : 'transparent',
                            boxShadow: active ? '0 8px 24px rgba(254,115,46,0.45)' : 'none',
                            transition: 'all 0.2s',
                            whiteSpace: 'nowrap',
                        }}
                        onMouseEnter={(e) => {
                            if (!active) e.currentTarget.style.color = '#e5e7eb';
                        }}
                        onMouseLeave={(e) => {
                            if (!active) e.currentTarget.style.color = '#9ca3af';
                        }}
                    >
                        <span style={{ fontSize: 16 }}>{link.icon}</span>
                        {link.label}
                        {link.external && <span style={{ fontSize: 11, opacity: 0.7 }}>↗</span>}
                    </button>
                );
            })}
        </div>
    );
}
