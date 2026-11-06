#!/usr/bin/env node
// Проверка исправлений аудита безопасности (SECURITY_AUDIT_2026-11_RU.md) для админки.
// Запуск: node scripts/check-security.mjs  (из корня репозитория, зависимости не нужны).
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

const root = process.cwd();
const read = (p) => readFileSync(path.join(root, p), 'utf8');
const results = [];
const check = (name, ok, detail = '') => results.push({ name, ok, detail });

// 1. AuthGuard: installStaffFetch вызывается на уровне модуля (до эффектов дочерних компонентов).
{
  const src = read('components/AuthGuard.tsx');
  const body = src.split('export default function AuthGuard')[0];
  check(
    'AuthGuard: installStaffFetch() на уровне модуля, до рендера',
    /^installStaffFetch\(\);/m.test(body),
  );
}

// 2. next.config.js: заголовки безопасности, CSP по умолчанию Report-Only, фреймы запрещены.
{
  const require = createRequire(import.meta.url);
  delete process.env.CSP_MODE;
  process.env.NEXT_PUBLIC_API_BASE_URL = 'https://api.example';
  process.env.NEXT_PUBLIC_VOIP_API_URL = 'https://voip.example';
  const cfg = require(path.join(root, 'next.config.js'));
  const rules = await cfg.headers();
  const all = rules.find((r) => r.source === '/:path*');
  const keys = new Map((all?.headers || []).map((h) => [h.key, h.value]));
  check(
    'next.config: заголовки безопасности на /:path*',
    ['X-Content-Type-Options', 'X-Frame-Options', 'Referrer-Policy', 'Strict-Transport-Security', 'Permissions-Policy'].every((k) => keys.has(k)),
    [...keys.keys()].join(', '),
  );
  check('next.config: X-Frame-Options DENY (админка не встраивается)', keys.get('X-Frame-Options') === 'DENY');
  const csp = keys.get('Content-Security-Policy-Report-Only') || '';
  check(
    'next.config: CSP по умолчанию Report-Only, с адресами API в connect-src и frame-ancestors none',
    !keys.has('Content-Security-Policy') && csp.includes('https://api.example') && csp.includes('https://voip.example') && csp.includes("frame-ancestors 'none'"),
  );
}

// 3. Нет невидимых символов в изменённых файлах.
{
  const bad = new RegExp('[' + [0x200b, 0x200c, 0x200d, 0xfeff, 0xa0].map((c) => String.fromCharCode(c)).join('') + ']');
  const files = ['next.config.js', 'components/AuthGuard.tsx', 'scripts/check-security.mjs', '.env.example'];
  const dirty = files.filter((f) => bad.test(read(f)));
  check('Нет невидимых символов в изменённых файлах', dirty.length === 0, dirty.join(', '));
}

let failed = 0;
for (const r of results) {
  if (!r.ok) failed += 1;
  console.log(`${r.ok ? 'ok  ' : 'FAIL'} - ${r.name}${r.detail ? ` (${r.detail})` : ''}`);
}
console.log(`\n${results.length - failed}/${results.length} проверок прошло`);
process.exit(failed ? 1 : 0);
