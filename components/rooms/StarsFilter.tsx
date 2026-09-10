'use client';

// Чипы звёзд 3★ / 4★ / 5★ (multi-select) → `stars=4,5` в GET /hotels/search.

import { Chip } from './shared';

export const STAR_OPTIONS = [3, 4, 5] as const;

export function parseStars(value: string | null | undefined): number[] {
    return String(value || '')
        .split(',')
        .map((s) => Number(s.trim()))
        .filter((n) => STAR_OPTIONS.includes(n as 3 | 4 | 5));
}

export function starsParam(stars: number[]): string {
    return [...stars].sort().join(',');
}

export default function StarsFilter({ value, onChange }: { value: number[]; onChange: (next: number[]) => void }) {
    const toggle = (n: number) => {
        if (value.includes(n)) onChange(value.filter((x) => x !== n));
        else onChange([...value, n].sort());
    };
    return (
        <div role="group" aria-label="Звёзды" style={{ display: 'flex', gap: 6 }}>
            {STAR_OPTIONS.map((n) => (
                <Chip key={n} active={value.includes(n)} onClick={() => toggle(n)} title={`${n} звёзд`}>
                    {n}★
                </Chip>
            ))}
        </div>
    );
}
