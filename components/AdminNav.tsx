'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Icon, { type IconName } from './Icon';
import ThemeToggle from './ThemeToggle';
import BrandLogo from './BrandLogo';
import { getStaffAuth, staffLogout, staffDisplayName, type StaffAuth } from '@/lib/staff-auth-api';
import { removeUser } from '@/lib/auth-api';
import { layout, radius, t } from '@/lib/theme';

type NavLink = {
    href: string;
    label: string;
    icon: IconName;
    /** Внешние ссылки открываются в новой вкладке и никогда не подсвечиваются. */
    external?: boolean;
};

const LINKS: NavLink[] = [
    { href: '/users', label: 'Пользователи', icon: 'user' },
    { href: '/orders', label: 'Заказы', icon: 'luggage' },
    { href: '/lt-orders', label: 'Level Travel', icon: 'globe' },
    { href: '/order-requests', label: 'Обращения', icon: 'mail' },
    { href: '/rooms', label: 'Отели и номера', icon: 'hotel' },
    { href: '/operators', label: 'Операторы', icon: 'list' },
    { href: '/notifications', label: 'Уведомления', icon: 'bell' },
    { href: '/pages', label: 'Страницы', icon: 'file' },
    { href: '/home-content', label: 'Главная', icon: 'home' },
    { href: '/callback-requests', label: 'Заявки на звонок', icon: 'smartPhone' },
    { href: '/partner-requests', label: 'Заявки партнёров', icon: 'list' },
    // Панель звонков живёт в отдельном приложении (calling_v2).
    { href: 'https://calling.totus.club', label: 'Звонки', icon: 'phone', external: true },
];

export default function AdminNav() {
    const pathname = usePathname();
    const router = useRouter();
    const [auth, setAuth] = useState<StaffAuth | null>(null);

    useEffect(() => {
        setAuth(getStaffAuth());
    }, []);

    // Флаг сдвигает контент PageShell вправо. На экране входа навигации нет,
    // поэтому страница остаётся во всю ширину.
    useEffect(() => {
        document.body.dataset.hasNav = '1';
        return () => {
            delete document.body.dataset.hasNav;
        };
    }, []);

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

    const logout = () => {
        staffLogout();
        removeUser(); // legacy-сессия агента, если осталась от старых версий
        router.push('/login');
    };

    return (
        <nav
            aria-label="Разделы админки"
            style={{
                position: 'fixed',
                top: 0,
                left: 0,
                bottom: 0,
                width: layout.sidebar,
                display: 'flex',
                flexDirection: 'column',
                background: t.surface,
                borderRight: `1px solid ${t.border}`,
                zIndex: 40,
            }}
        >
            <div style={{ padding: '24px 20px 20px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                {/* Тот же логотип, что в Calling Dashboard (calling_v2). */}
                <BrandLogo height={28} />
                <div style={{ fontSize: 12, lineHeight: '16px', color: t.textTertiary }}>Админка</div>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '0 12px', display: 'flex', flexDirection: 'column', gap: 2 }}>
                {LINKS.map((link) => {
                    const active = isActive(link);
                    return (
                        <button
                            key={link.href}
                            onClick={() => navigate(link)}
                            title={link.external ? 'Откроется в новой вкладке' : undefined}
                            aria-current={active ? 'page' : undefined}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 10,
                                width: '100%',
                                padding: '10px 12px',
                                borderRadius: radius.sm,
                                border: 'none',
                                cursor: 'pointer',
                                textAlign: 'left',
                                fontSize: 14,
                                fontFamily: 'inherit',
                                fontWeight: active ? 600 : 500,
                                color: active ? t.accent : t.textSecondary,
                                background: active ? t.accentSoft : 'transparent',
                                transition: 'background 0.15s, color 0.15s',
                            }}
                            onMouseEnter={(e) => {
                                if (!active) e.currentTarget.style.background = t.surfaceHover;
                            }}
                            onMouseLeave={(e) => {
                                if (!active) e.currentTarget.style.background = 'transparent';
                            }}
                        >
                            <Icon name={link.icon} size={20} />
                            <span style={{ flex: 1 }}>{link.label}</span>
                            {link.external && <Icon name="linkExternal" size={14} style={{ opacity: 0.6 }} />}
                        </button>
                    );
                })}
            </div>

            <div style={{ padding: 12, borderTop: `1px solid ${t.border}`, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <ThemeToggle />
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '4px 4px 0' }}>
                    <div
                        aria-hidden
                        style={{
                            width: 32,
                            height: 32,
                            borderRadius: radius.pill,
                            background: t.accentSoft,
                            color: t.accent,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                        }}
                    >
                        <Icon name="user" size={18} />
                    </div>
                    <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: t.textPrimary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {staffDisplayName(auth)}
                        </div>
                        <div style={{ fontSize: 11, color: t.textTertiary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {auth?.profile?.email || ''}
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={logout}
                        title="Выйти"
                        aria-label="Выйти"
                        style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: 32,
                            height: 32,
                            borderRadius: radius.sm,
                            border: 'none',
                            background: 'transparent',
                            color: t.textTertiary,
                            cursor: 'pointer',
                        }}
                    >
                        <Icon name="logout" size={18} />
                    </button>
                </div>
            </div>
        </nav>
    );
}
