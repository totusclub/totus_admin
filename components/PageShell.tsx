'use client';

import { ReactNode } from 'react';
import { layout, t } from '@/lib/theme';

/**
 * Каркас страницы админки.
 *
 * Фон и отступы — из дизайн-системы: никаких чёрных заливок, радиальных
 * градиентов и размытых пятен. Поля страницы (32/32/64) и сдвиг под боковую
 * навигацию задают CSS-правила .totus-shell и body[data-has-nav] .totus-shell
 * в globals.css. Инлайновый padding здесь не ставим: он перебил бы сдвиг, и
 * меню перекрывало бы контент. Экран входа, где навигации нет, остаётся во
 * всю ширину.
 */
export default function PageShell({ children }: { children: ReactNode }) {
    return (
        <div
            className="totus-shell"
            style={{
                minHeight: '100vh',
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
