'use client';

/**
 * Единая раскладка страниц админки.
 *
 * Шаблон страницы-списка: одна карточка pageCard (поля 24, промежутки 20) —
 * PageHeader → Toolbar (поиск, фильтры) → список listStyle (промежуток 12)
 * из элементов listItemStyle (поля 16/20, скругление 12, фон surfaceInset).
 * Шаблон страницы-детали: карточка с крошками и PageHeader, ниже карточки
 * разделов с промежутком space.page (24) — как у PageShell.
 */

import type { CSSProperties, ReactNode } from 'react';
import Icon from './Icon';
import { t, radius, text, cardStyle, inputStyle, button } from '@/lib/theme';

export const space = { page: 24, section: 20, list: 12, inline: 8 } as const;

export const pageCard: CSSProperties = {
    ...cardStyle,
    display: 'flex',
    flexDirection: 'column',
    gap: space.section,
    minWidth: 0,
};

export const listStyle: CSSProperties = { display: 'grid', gap: space.list };

export const listItemStyle: CSSProperties = {
    padding: '16px 20px',
    borderRadius: radius.md,
    border: `1px solid ${t.border}`,
    background: t.surfaceInset,
};

export const emptyTextStyle: CSSProperties = {
    padding: 24,
    textAlign: 'center',
    ...text.body,
    color: t.textTertiary,
};

/** Заголовок раздела внутри карточки (16/24, полужирный). */
export const blockTitle: CSSProperties = { ...text.cardTitle, margin: 0 };

export function PageHeader({
    title,
    subtitle,
    actions,
    before,
}: {
    title: ReactNode;
    subtitle?: ReactNode;
    actions?: ReactNode;
    /** Крошки или ссылка «назад» над заголовком. */
    before?: ReactNode;
}) {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, minWidth: 0 }}>
            {before}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
                <div style={{ flex: '1 1 320px', minWidth: 0 }}>
                    <h1
                        style={{
                            ...text.pageTitle,
                            margin: 0,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 12,
                            flexWrap: 'wrap',
                            overflowWrap: 'anywhere',
                        }}
                    >
                        {title}
                    </h1>
                    {subtitle ? <div style={{ ...text.caption, marginTop: 6, maxWidth: 720 }}>{subtitle}</div> : null}
                </div>
                {actions ? (
                    <div style={{ display: 'flex', gap: space.inline, flexWrap: 'wrap', alignItems: 'center' }}>{actions}</div>
                ) : null}
            </div>
        </div>
    );
}

/** Строка поиска и фильтров под заголовком. */
export function Toolbar({ children }: { children: ReactNode }) {
    return <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>{children}</div>;
}

export function SearchInput({
    value,
    onChange,
    placeholder,
    ariaLabel,
    type = 'text',
    inputMode,
    onKeyDown,
}: {
    value: string;
    onChange: (value: string) => void;
    placeholder: string;
    ariaLabel?: string;
    type?: 'text' | 'search';
    inputMode?: 'numeric' | 'text';
    onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
}) {
    return (
        <div style={{ position: 'relative', flex: '1 1 280px', minWidth: 220 }}>
            <span
                aria-hidden
                style={{
                    position: 'absolute',
                    left: 14,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: t.textTertiary,
                    display: 'flex',
                    pointerEvents: 'none',
                }}
            >
                <Icon name="search" size={18} />
            </span>
            <input
                type={type}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder={placeholder}
                aria-label={ariaLabel || placeholder}
                inputMode={inputMode}
                style={{ ...inputStyle, paddingLeft: 42, outline: 'none' }}
            />
        </div>
    );
}

export function RefreshButton({ onClick, loading, label = 'Обновить' }: { onClick: () => void; loading?: boolean; label?: string }) {
    return (
        <button
            type="button"
            onClick={onClick}
            disabled={loading}
            style={{
                ...button('secondary', 'md'),
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.6 : 1,
            }}
        >
            <Icon name="refresh" size={16} />
            {loading ? 'Обновление...' : label}
        </button>
    );
}
