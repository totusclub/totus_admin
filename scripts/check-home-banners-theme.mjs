// Админка → «Главная страница» → «Hero и баннеры»: у каждого из двух баннеров своя ссылка
// и свои картинки для светлой и тёмной темы. Запуск: node scripts/check-home-banners-theme.mjs
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

const api = read('lib/home-banners-api.ts');
const ui = read('components/admin/home/HeroBannersSection.tsx');

console.log('Админка: баннеры главной, светлая и тёмная тема');

check('API: image и image_dark отдельно, «убрать» отдельно для каждой темы', () => {
  assert.match(api, /image_dark\?: string;/);
  assert.match(api, /formData\.append\('image', input\.image\);\s*\} else if \(input\.removeImage\) \{\s*formData\.append\('remove_image', '1'\);/);
  assert.match(api, /formData\.append\('image_dark', input\.imageDark\);\s*\} else if \(input\.removeImageDark\) \{\s*formData\.append\('remove_image_dark', '1'\);/);
  assert.match(api, /\/api\/admin\/home-banners\/\$\{position\}/);
});

check('экран: два баннера, у каждого блоки «Светлая тема» и «Тёмная тема»', () => {
  assert.match(ui, /<BannerSlot position=\{1\}/);
  assert.match(ui, /<BannerSlot position=\{2\}/);
  assert.match(ui, /light: 'Светлая тема', dark: 'Тёмная тема'/);
  assert.match(ui, /\(\['light', 'dark'\] as BannerTheme\[\]\)\.map/);
});

check('пустая тема объясняет, что покажет сайт', () => {
  assert.match(ui, /Не загружена — на сайте стандартная картинка/);
  assert.match(ui, /Не загружена — в тёмной теме показывается светлая/);
});

check('сохранение одного баннера отправляет обе темы и не трогает второй баннер', () => {
  assert.match(ui, /saveHomeBanner\(position, \{\s*url,\s*image: images\.light\.file,\s*imageDark: images\.dark\.file,\s*removeImage: images\.light\.remove,\s*removeImageDark: images\.dark\.remove,\s*\}\)/);
  assert.match(ui, /prev\.map\(\(b\) => \(b\.position === saved\.position \? saved : b\)\)/);
});

check('файлы проверяются как на сервере (JPG / PNG / WEBP, 15 МБ); цвета только из темы', () => {
  assert.match(ui, /const problem = validateHeroFiles\(\[file\]\);/);
  assert.match(ui, /accept=\{HERO_ACCEPT\}/);
  assert.ok(!/accept="image\/\*"/.test(ui));
  assert.ok(!/#[0-9a-fA-F]{3,6}\b/.test(ui.replace(/#\$\{[^}]*\}/g, '')), 'без захардкоженных цветов');
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
