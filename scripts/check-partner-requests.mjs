// Раздел «Заявки партнёров» (форма на totus.club/partners → totus_API → админка).
// Node ≥ 22.18, без npm install: node scripts/check-partner-requests.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(join(root, rel), 'utf8');

let passed = 0;
let failed = 0;
function check(name, fn) {
    try {
        fn();
        passed++;
        console.log(`  ok   ${name}`);
    } catch (e) {
        failed++;
        console.log(`  FAIL ${name}\n       ${e && e.message ? e.message : e}`);
    }
}

console.log('Заявки партнёров');

check('меню: пункт «Заявки партнёров» ведёт на /partner-requests (не на /partners — там раздел главной)', () => {
    const nav = read('components/AdminNav.tsx');
    assert.match(nav, /\{ href: '\/partner-requests', label: 'Заявки партнёров', icon: 'list' \}/);
    const icon = read('components/Icon.tsx');
    assert.match(icon, /\blist\b/, 'иконка list есть в Icon.tsx');
});

check('API: только существующие эндпоинты totus_API, staff-токен через authFetch, адрес из lib/server', () => {
    const api = read('lib/partner-requests-api.ts');
    assert.match(api, /import \{ API_BASE_URL \} from '\.\/server';/);
    assert.match(api, /import \{ authFetch \} from '\.\/staff-auth-api';/);
    assert.ok(!/https?:\/\//.test(api), 'нет адресов в коде');
    assert.match(api, /`\$\{API_BASE_URL\}\/api\/admin\/partner-requests\$\{qs \? `\?\$\{qs\}` : ''\}`/);
    assert.match(api, /method: 'PATCH'/);
    assert.match(api, /method: 'DELETE'/);
    for (const s of ["'new'", "'in_progress'", "'done'", "'rejected'", "'operator'", "'hotel'", "'ads'", "'other'"]) {
        assert.ok(api.includes(s), s);
    }
});

check('страница: список, фильтр по статусу со счётчиками, поиск, страницы, заметка, смена статуса, удаление', () => {
    const page = read('app/partner-requests/page.tsx');
    assert.match(page, /^'use client';/);
    assert.match(page, /<PageShell>[\s\S]*<AdminNav \/>/);
    for (const s of [
        'listPartnerRequests(', 'updatePartnerRequest(r.id, { status })', 'updatePartnerRequest(r.id, { note })',
        'deletePartnerRequest(r.id)', 'confirm(', 'counts[f.value]', 'offset: page * PAGE_LIMIT',
        "router.replace('/login')", 'staff_session_expired', 'mailto:', 'tel:', 'Заметка сотрудника',
    ]) assert.ok(page.includes(s), `нет «${s}»`);
    assert.ok(!/#[0-9a-f]{3,6}\b/i.test(page), 'без жёстких цветов — только токены темы');
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
