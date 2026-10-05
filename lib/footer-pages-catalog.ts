export type FooterSection = 'company' | 'contact' | 'more' | 'legal';

export type FooterPageCatalogItem = {
    slug: string;
    title: string;
    breadcrumbLabel: string;
    mobileHeaderTitle: string;
    section: FooterSection;
    group: string;
    seoTitle: string;
    seoDescription: string;
    seoKeywords: string;
    defaultContent: string;
    publicPath: string;
};

const p = (text: string) => `<p>${text}</p>`;

export const FOOTER_PAGE_CATALOG: FooterPageCatalogItem[] = [
    {
        slug: 'about-us',
        title: 'О Нас',
        breadcrumbLabel: 'О Нас',
        mobileHeaderTitle: 'О Нас',
        section: 'company',
        group: 'Контакт',
        seoTitle: 'О нас',
        seoDescription: 'Totus Club — сервис по поиску и бронированию туров и отелей.',
        seoKeywords: 'Totus Club, о нас, туры, бронирование',
        defaultContent: [
            p('<strong>Totus Club</strong> — сервис по поиску и бронированию турпакетов и отелей.'),
            p('Мы объединяем предложения партнёров и помогаем путешественникам выбирать поездку с прозрачными условиями.'),
            p('Если у вас есть вопросы по сотрудничеству или сервису, воспользуйтесь контактами на сайте.'),
        ].join('\n'),
        publicPath: '/about-us',
    },
    {
        slug: 'help-faq',
        title: 'Помощь/Часто задаваемые вопросы',
        breadcrumbLabel: 'Помощь / FAQ',
        mobileHeaderTitle: 'Помощь/FAQ',
        section: 'contact',
        group: 'Контакт',
        seoTitle: 'Помощь и FAQ',
        seoDescription: 'Помощь и частые вопросы по сервису Totus Club.',
        seoKeywords: 'Totus Club, помощь, FAQ, поддержка',
        defaultContent: p('Ответы на популярные вопросы о поиске туров, оплате, изменении заказа и возвратах.'),
        publicPath: '/help-faq',
    },
    {
        slug: 'partners',
        title: 'Партнеры',
        breadcrumbLabel: 'Партнеры',
        mobileHeaderTitle: 'Партнеры',
        section: 'contact',
        group: 'Контакт',
        seoTitle: 'Партнеры',
        seoDescription: 'Партнёрская программа Totus Club.',
        seoKeywords: 'Totus Club, партнеры',
        defaultContent: p('Информация о сотрудничестве с Totus Club для туроператоров и партнёров.'),
        publicPath: '/partners',
    },
    {
        slug: 'advertise',
        title: 'Рекламируйтесь у нас',
        breadcrumbLabel: 'Реклама',
        mobileHeaderTitle: 'Реклама',
        section: 'contact',
        group: 'Контакт',
        seoTitle: 'Рекламируйтесь у нас',
        seoDescription: 'Рекламные возможности Totus Club.',
        seoKeywords: 'Totus Club, реклама',
        defaultContent: p('Разместите рекламу на платформе Totus Club и расскажите о своём предложении путешественникам.'),
        publicPath: '/advertise',
    },
    {
        slug: 'airlines',
        title: 'Авиакомпании',
        breadcrumbLabel: 'Авиакомпании',
        mobileHeaderTitle: 'Авиакомпании',
        section: 'more',
        group: 'Еще',
        seoTitle: 'Авиакомпании',
        seoDescription: 'Авиакомпании-партнёры Totus Club.',
        seoKeywords: 'Totus Club, авиакомпании',
        defaultContent: p('Список авиакомпаний и полезная информация для путешественников.'),
        publicPath: '/airlines',
    },
    {
        slug: 'low-fare-tips',
        title: 'Советы по низким тарифам',
        breadcrumbLabel: 'Низкие тарифы',
        mobileHeaderTitle: 'Низкие тарифы',
        section: 'more',
        group: 'Еще',
        seoTitle: 'Советы по низким тарифам',
        seoDescription: 'Как найти выгодные тарифы на Totus Club.',
        seoKeywords: 'Totus Club, низкие тарифы, советы',
        defaultContent: p('Практические советы, как выбрать тур и сэкономить на перелёте.'),
        publicPath: '/low-fare-tips',
    },
    {
        slug: 'badges-certificates',
        title: 'Документы',
        breadcrumbLabel: 'Документы',
        mobileHeaderTitle: 'Документы',
        section: 'more',
        group: 'Еще',
        seoTitle: 'Документы',
        seoDescription: 'Документы и сертификаты Totus Club.',
        seoKeywords: 'Totus Club, документы, сертификаты',
        defaultContent: p('Официальные документы, лицензии и сертификаты Totus Club.'),
        publicPath: '/badges-certificates',
    },
    {
        slug: 'security',
        title: 'Безопасность',
        breadcrumbLabel: 'Безопасность',
        mobileHeaderTitle: 'Безопасность',
        section: 'more',
        group: 'Еще',
        seoTitle: 'Безопасность',
        seoDescription: 'Безопасность платежей и данных на Totus Club.',
        seoKeywords: 'Totus Club, безопасность',
        defaultContent: p('Как Totus Club защищает ваши данные и платежи при бронировании туров.'),
        publicPath: '/security',
    },
    {
        slug: 'cookie-settings',
        title: 'Политика использования файлов cookie',
        breadcrumbLabel: 'Политика cookie',
        mobileHeaderTitle: 'Политика cookie',
        section: 'legal',
        group: 'Правовая информация',
        seoTitle: 'Политика использования файлов cookie',
        seoDescription: 'Политика использования файлов cookie на сайте и в приложениях Totus Club.',
        seoKeywords: 'Totus Club, cookie, куки',
        defaultContent: p('На этой странице вы можете узнать, как Totus Club использует файлы cookie.'),
        publicPath: '/cookie-settings',
    },
    {
        slug: 'privacy-policy',
        title: 'Политика обработки персональных данных',
        breadcrumbLabel: 'Политика обработки персональных данных',
        mobileHeaderTitle: 'Политика обработки персональных данных',
        section: 'legal',
        group: 'Правовая информация',
        seoTitle: 'Политика обработки персональных данных',
        seoDescription: 'Политика ООО «ТОТУСКЛАБ» в отношении обработки персональных данных пользователей Totus Club.',
        seoKeywords: 'Totus Club, конфиденциальность, персональные данные',
        defaultContent: p('Здесь будет опубликована политика конфиденциальности Totus Club.'),
        publicPath: '/privacy-policy',
    },
    {
        slug: 'terms',
        title: 'Пользовательское соглашение',
        breadcrumbLabel: 'Пользовательское соглашение',
        mobileHeaderTitle: 'Пользовательское соглашение',
        section: 'legal',
        group: 'Правовая информация',
        seoTitle: 'Пользовательское соглашение',
        seoDescription: 'Условия использования Totus Club.',
        seoKeywords: 'Totus Club, условия, пользовательское соглашение',
        defaultContent: p('Пользовательское соглашение и условия использования сервиса Totus Club.'),
        publicPath: '/terms',
    },
    {
        slug: 'consent',
        title: 'Согласие на обработку персональных данных',
        breadcrumbLabel: 'Согласие на обработку персональных данных',
        mobileHeaderTitle: 'Согласие на обработку персональных данных',
        section: 'legal',
        group: 'Правовая информация',
        seoTitle: 'Согласие на обработку персональных данных',
        seoDescription: 'Согласие пользователя Totus Club на обработку персональных данных ООО «ТОТУСКЛАБ».',
        seoKeywords: 'Totus Club, согласие, персональные данные',
        defaultContent: p('Текст документа будет опубликован на этой странице.'),
        publicPath: '/consent',
    },
    {
        slug: 'ads-consent',
        title: 'Согласие на получение рекламы',
        breadcrumbLabel: 'Согласие на рекламу',
        mobileHeaderTitle: 'Согласие на рекламу',
        section: 'legal',
        group: 'Правовая информация',
        seoTitle: 'Согласие на получение рекламы',
        seoDescription: 'Согласие на получение рекламных и информационных рассылок Totus Club.',
        seoKeywords: 'Totus Club, согласие, реклама, рассылки',
        defaultContent: p('Текст документа будет опубликован на этой странице.'),
        publicPath: '/ads-consent',
    },
    {
        slug: 'recommendations',
        title: 'Правила применения рекомендательных технологий',
        breadcrumbLabel: 'Рекомендательные технологии',
        mobileHeaderTitle: 'Рекомендательные технологии',
        section: 'legal',
        group: 'Правовая информация',
        seoTitle: 'Правила применения рекомендательных технологий',
        seoDescription: 'Как Totus Club применяет рекомендательные технологии.',
        seoKeywords: 'Totus Club, рекомендательные технологии',
        defaultContent: p('Текст документа будет опубликован на этой странице.'),
        publicPath: '/recommendations',
    },
    {
        slug: 'requisites',
        title: 'Реквизиты и контакты',
        breadcrumbLabel: 'Реквизиты и контакты',
        mobileHeaderTitle: 'Реквизиты и контакты',
        section: 'legal',
        group: 'Правовая информация',
        seoTitle: 'Реквизиты и контакты',
        seoDescription: 'Реквизиты ООО «ТОТУСКЛАБ» и контакты службы поддержки Totus Club.',
        seoKeywords: 'Totus Club, реквизиты, контакты, ТОТУСКЛАБ',
        defaultContent: p('Текст документа будет опубликован на этой странице.'),
        publicPath: '/requisites',
    },
];

export const FOOTER_PAGE_BY_SLUG = Object.fromEntries(
    FOOTER_PAGE_CATALOG.map((item) => [item.slug, item]),
) as Record<string, FooterPageCatalogItem>;

/** Only these slugs can be edited in admin and saved via CMS API */
export const ALLOWED_ADMIN_PAGE_SLUGS = FOOTER_PAGE_CATALOG.map((item) => item.slug);

export const SECTION_LABELS: Record<FooterSection, string> = {
    company: 'Компания',
    contact: 'Контакт',
    more: 'Еще',
    legal: 'Документы',
};

export const PUBLIC_SITE_URL = 'https://totus.club';
