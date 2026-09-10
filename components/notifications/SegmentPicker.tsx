'use client';

// Аудитория рассылки: «Все пользователи» либо комбинация сегментов
// (платформы, есть заказы, вылет в диапазоне дат). Пустой сегмент = все.

import { t, radius, text } from '@/lib/theme';
import type { PushPlatform, Segment } from '@/lib/push-api';
import { checkboxRow, compactInput, fieldLabel } from './shared';

const PLATFORMS: { value: PushPlatform; label: string }[] = [
    { value: 'ios', label: 'iOS' },
    { value: 'android', label: 'Android' },
    { value: 'web', label: 'Сайт' },
    { value: 'desktop', label: 'Desktop' },
];

export function isSegmentEmpty(segment: Segment): boolean {
    return !segment.platforms?.length && !segment.hasOrders && !segment.departureFrom && !segment.departureTo && !segment.userIds?.length;
}

export default function SegmentPicker({
    segment,
    onChange,
    audience,
    audienceState,
    onRecount,
}: {
    segment: Segment;
    onChange: (next: Segment) => void;
    audience: { users: number; devices: number } | null;
    audienceState: 'idle' | 'loading' | 'error';
    onRecount: () => void;
}) {
    const all = isSegmentEmpty(segment);

    const togglePlatform = (p: PushPlatform) => {
        const current = segment.platforms || [];
        const next = current.includes(p) ? current.filter((x) => x !== p) : [...current, p];
        onChange({ ...segment, platforms: next.length ? next : undefined });
    };

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
                <span style={fieldLabel}>Аудитория</span>
                <span style={{ ...text.caption, display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                    {audienceState === 'loading' ? (
                        'Считаем...'
                    ) : audienceState === 'error' ? (
                        <span style={{ color: t.error }}>Не удалось посчитать</span>
                    ) : audience ? (
                        <span>
                            Получателей: <b style={{ color: t.textPrimary }}>{audience.users}</b> · устройств:{' '}
                            <b style={{ color: t.textPrimary }}>{audience.devices}</b>
                        </span>
                    ) : (
                        '—'
                    )}
                    <button
                        type="button"
                        onClick={onRecount}
                        style={{ background: 'none', border: 'none', color: t.accent, cursor: 'pointer', fontSize: 13, fontWeight: 600, padding: 0, fontFamily: 'inherit' }}
                    >
                        Пересчитать
                    </button>
                </span>
            </div>

            <div
                style={{
                    display: 'grid',
                    gap: 10,
                    padding: 12,
                    borderRadius: radius.md,
                    border: `1px solid ${t.border}`,
                    background: t.surfaceInset,
                }}
            >
                <label style={checkboxRow}>
                    <input type="checkbox" checked={all} onChange={() => onChange({})} />
                    Все пользователи
                </label>

                <div>
                    <div style={{ ...text.caption, marginBottom: 6 }}>Платформа</div>
                    <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
                        {PLATFORMS.map((p) => (
                            <label key={p.value} style={checkboxRow}>
                                <input type="checkbox" checked={!!segment.platforms?.includes(p.value)} onChange={() => togglePlatform(p.value)} />
                                {p.label}
                            </label>
                        ))}
                    </div>
                </div>

                <label style={checkboxRow}>
                    <input
                        type="checkbox"
                        checked={!!segment.hasOrders}
                        onChange={(e) => onChange({ ...segment, hasOrders: e.target.checked || undefined })}
                    />
                    Есть заказы
                </label>

                <div>
                    <div style={{ ...text.caption, marginBottom: 6 }}>Вылет в диапазоне дат</div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                        <input
                            type="date"
                            style={{ ...compactInput, width: 'auto' }}
                            value={segment.departureFrom || ''}
                            onChange={(e) => onChange({ ...segment, departureFrom: e.target.value || undefined })}
                        />
                        <span style={text.caption}>—</span>
                        <input
                            type="date"
                            style={{ ...compactInput, width: 'auto' }}
                            value={segment.departureTo || ''}
                            onChange={(e) => onChange({ ...segment, departureTo: e.target.value || undefined })}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}
