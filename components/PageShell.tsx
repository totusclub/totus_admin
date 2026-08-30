'use client';

import { ReactNode } from 'react';
import { layout, t } from '@/lib/theme';

/**
 * Каркас страницы админки.
 *
 * Фон и отступы — из дизайн-системы: никаких чёрных заливок, радиальных
 * градиентов и размытых пятен. Сдвиг под боковую навигацию делает CSS-правило
 * body[data-has-nav] .totus-shell в globals.css, поэтому экран входа, где
 * навигации нет, остаётся во всю ширину.
 */
export default function PageShell({ children }: { children: ReactNode }) {
    return (
        <div
            className="totus-shell"
            style={{
                minHeight: '100vh',
                padding: '32px 32px 64px',
                background: t.bg,
                display: 'flex',
                justifyContent: 'center',
                transition: 'padding-left 0.2s',
            }}
        >
            <div
                style={{
                    width: '100%',
                    maxWidth: layout.contentMax,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 24,
                }}
            >
                {children}
            </div>
        </div>
    );
}
