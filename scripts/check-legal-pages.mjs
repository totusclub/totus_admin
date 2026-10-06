// Юридические документы ТОТУСКЛАБ в админке (03.10.2026).
// Поломка: в каталоге страниц было 11 страниц футера — 4 новых документа
// (согласие на обработку персональных данных, согласие на рекламу,
// рекомендательные технологии, реквизиты)
// нельзя было открыть и сохранить в разделе «Страницы сайта».
// Пачка 2 (05.10.2026): ещё 5 документов — оферта о заключении договора о реализации
// туристского продукта, условия бронирования размещения, изменение, отмена и возврат,
// памятка туристу, оплата и возврат денег.
// Запуск: node scripts/check-legal-pages.mjs (Node >= 22.18, без npm install).
import assert from 'node:assert/strict';

const { FOOTER_PAGE_CATALOG, FOOTER_PAGE_BY_SLUG, ALLOWED_ADMIN_PAGE_SLUGS } =
    await import('../lib/footer-pages-catalog.ts');

// Должно совпадать с ALLOWED_CMS_PAGE_SLUGS в totus_API/config/cmsPages.js
const API_ALLOWED = [
    'about-us', 'help-faq', 'partners', 'advertise', 'airlines', 'low-fare-tips',
    'badges-certificates', 'security', 'cookie-settings', 'privacy-policy', 'terms',
    'consent', 'ads-consent', 'recommendations', 'requisites',
    'tour-offer', 'hotel-booking', 'cancellation', 'tourist-memo', 'payment',
];
const LEGAL = {
    terms: 'Пользовательское соглашение',
    'privacy-policy': 'Политика обработки персональных данных',
    consent: 'Согласие на обработку персональных данных',
    'ads-consent': 'Согласие на получение рекламы',
    'cookie-settings': 'Политика использования файлов cookie',
    recommendations: 'Правила применения рекомендательных технологий',
    requisites: 'Реквизиты и контакты',
    'tour-offer': 'Оферта о заключении договора о реализации туристского продукта',
    'hotel-booking': 'Условия бронирования размещения',
    cancellation: 'Изменение, отмена и возврат',
    'tourist-memo': 'Памятка туристу',
    payment: 'Оплата и возврат денег',
};

let passed = 0;
let failed = 0;
function check(name, fn) {
    try { fn(); passed += 1; console.log('ok  ', name); }
    catch (e) { failed += 1; console.log('FAIL', name, '—', e.message); }
}

check('каталог совпадает с allowlist API (20 страниц)', () => {
    assert.deepEqual([...ALLOWED_ADMIN_PAGE_SLUGS].sort(), [...API_ALLOWED].sort());
});
check('slug не повторяются', () => {
    assert.equal(new Set(FOOTER_PAGE_CATALOG.map((i) => i.slug)).size, FOOTER_PAGE_CATALOG.length);
});
for (const [slug, title] of Object.entries(LEGAL)) {
    check(`«${slug}»: в каталоге, раздел «Документы», название и адрес`, () => {
        const item = FOOTER_PAGE_BY_SLUG[slug];
        assert.ok(item, 'нет в каталоге');
        assert.equal(item.title, title);
        assert.equal(item.section, 'legal');
        assert.equal(item.group, 'Правовая информация');
        assert.equal(item.publicPath, `/${slug}`);
        assert.ok(item.seoTitle && item.seoDescription && item.breadcrumbLabel && item.mobileHeaderTitle);
    });
}

// Требование владельца (05.10.2026): в названиях документов нет сокращений
// («ПДн» → «персональных данных») и нет прежнего оператора (Арлекинотур / Arlekino).
const FORBIDDEN = [
    [/ПДн/u, '«ПДн» (писать «персональных данных»)'],
    [/арлекино|arlekino/iu, 'Арлекинотур / Arlekino'],
];
const TEXT_FIELDS = [
    'title', 'breadcrumbLabel', 'mobileHeaderTitle', 'group',
    'seoTitle', 'seoDescription', 'seoKeywords', 'defaultContent',
];
check('в каталоге нет «ПДн» и Арлекинотур / Arlekino', () => {
    const hits = [];
    for (const item of FOOTER_PAGE_CATALOG) {
        for (const field of TEXT_FIELDS) {
            const value = String(item[field] ?? '');
            for (const [re, label] of FORBIDDEN) {
                if (re.test(value)) hits.push(`${item.slug}.${field}: ${label} — «${value}»`);
            }
        }
    }
    assert.deepEqual(hits, []);
});
for (const slug of [
    'privacy-policy', 'consent',
    'tour-offer', 'hotel-booking', 'cancellation', 'tourist-memo', 'payment',
]) {
    check(`«${slug}»: хлебные крошки и мобильный заголовок равны полному названию`, () => {
        const item = FOOTER_PAGE_BY_SLUG[slug];
        assert.equal(item.breadcrumbLabel, LEGAL[slug]);
        assert.equal(item.mobileHeaderTitle, LEGAL[slug]);
    });
}

console.log(`check-legal-pages: ${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
