// Админка: «Чаты с Машей» — история чатов пользователя с ИИ, только просмотр.
// Запуск: node scripts/check-ai-chats.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(path.join(root, rel), 'utf8');

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

const users = read('app/users/page.tsx');
const page = read('app/users/[userId]/ai-chats/page.tsx');
const api = read('lib/ai-chats-api.ts');

console.log('Админка: чаты с Машей');

check('в списке пользователей у каждого — кнопка «Чаты с Машей» рядом с «Заказы»', () => {
  assert.match(users, /onClick=\{\(\) => router\.push\(`\/users\/\$\{user\.id\}\/ai-chats`\)\}[\s\S]*?Чаты с Машей/);
  assert.ok(users.indexOf('Чаты с Машей') < users.indexOf('>\n                                        Заказы'), 'перед «Заказы»');
  assert.match(users, /getAiChatSummary\(\)[\s\S]*?\.catch\(/, 'число чатов не ломает список, если не загрузилось');
});

check('API — totus_API /api/admin/ai-chats, только GET, без кеша', () => {
  assert.match(api, /const BASE = `\$\{API_BASE_URL\}\/api\/admin\/ai-chats`;/);
  assert.ok(!/method:\s*'(POST|PUT|PATCH|DELETE)'/.test(api), 'никаких изменений чатов');
  assert.match(api, /cache: 'no-store'/);
});

check('страница: история чатов слева, переписка справа, поиск, копирование', () => {
  for (const s of ['История чатов', 'Поиск по переписке', 'Скопировать чат', 'У пользователя нет чатов с Машей', "'Маша'"]) assert.ok(page.includes(s), s);
  assert.match(page, /getUserAiChats\(userId\)/);
  assert.match(page, /getAiChat\(activeId\)/);
  assert.match(page, /whiteSpace: 'pre-wrap'/, 'текст как есть, без HTML');
  assert.ok(!/dangerouslySetInnerHTML/.test(page), 'текст переписки не вставляется как HTML');
  assert.match(page, /rel="noopener noreferrer"/);
});

check('цвета — только токены темы', () => {
  assert.ok(!/#[0-9a-fA-F]{3,6}\b/.test(page) && !/rgba?\(/.test(page));
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
