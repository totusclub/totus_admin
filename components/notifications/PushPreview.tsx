'use client';

// Предпросмотр системного баннера: иконка приложения, «Totus Club · сейчас»,
// заголовок (≤ 40) и текст (≤ 120), как в DESIGN.md.

import { t, radius, text } from '@/lib/theme';

export default function PushPreview({ title, body }: { title: string; body: string }) {
    const shownTitle = title.trim() || 'Заголовок уведомления';
    const shownBody = body.trim() || 'Текст уведомления появится здесь';
    return (
        <div
            style={{
                display: 'flex',
                gap: 12,
                padding: '12px 14px',
                borderRadius: radius.lg,
                background: t.surfaceInset,
                border: `1px solid ${t.border}`,
                boxShadow: t.shadowRaised,
            }}
        >
            <div
                aria-hidden
                style={{
                    width: 40,
                    height: 40,
                    borderRadius: 10,
                    background: t.accent,
                    color: t.textOnAccent,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 700,
                    fontSize: 14,
                    letterSpacing: '-0.02em',
                    flexShrink: 0,
                }}
            >
                T
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ ...text.caption, fontSize: 12, marginBottom: 2 }}>Totus Club · сейчас</div>
                <div
                    style={{
                        fontSize: 14,
                        lineHeight: '20px',
                        fontWeight: 600,
                        color: title.trim() ? t.textPrimary : t.textTertiary,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                    }}
                >
                    {shownTitle}
                </div>
                <div
                    style={{
                        fontSize: 13,
                        lineHeight: '18px',
                        color: body.trim() ? t.textSecondary : t.textTertiary,
                        display: '-webkit-box',
                        WebkitLineClamp: 3,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                        wordBreak: 'break-word',
                    }}
                >
                    {shownBody}
                </div>
            </div>
        </div>
    );
}
