# Totus Admin

Админ-панель Totus Club (Next.js 14, App Router). Выделена из репозитория `calling_v2` 27.08.2026 — сюда перенесены все админские разделы, а панель звонков (WebRTC / VoIP) осталась в `calling_v2` и доступна по адресу https://calling.totus.club.

## Маршруты

| Путь | Что делает |
|------|------------|
| `/` | редирект на `/users` |
| `/login` | вход агента (email + пароль) |
| `/users` | список пользователей (voip backend) |
| `/orders` | все заказы, либо заказы одного пользователя (`?userId=`) |
| `/orders/[orderId]` | карточка заказа + живые данные Level Travel |
| `/lt-orders` | заказы напрямую из Level Travel (`?token=`) |
| `/pages` | список страниц футера сайта (CMS) |
| `/pages/[slug]` | редактор страницы (rich text) |
| `/home-content` | главная страница сайта: hero, баннеры, заголовки, отели, направления, партнёры, FAQ, соцсети |
| `/callback-requests` | заявки «Перезвоните мне» |
| `/banners`, `/faq`, `/partners` | редиректы на соответствующие секции `/home-content` |

В навигации последним пунктом стоит внешняя ссылка «Звонки» → https://calling.totus.club.

## Переменные окружения

Скопируйте `.env.example` в `.env.local`:

```
NEXT_PUBLIC_VOIP_API_URL=https://voip.totus.club     # voip backend: логин, пользователи
NEXT_PUBLIC_API_BASE_URL=https://api.totus.club      # kedam_API: заказы, CMS, контент главной
```

Обе переменные необязательны — при отсутствии используются продовые значения выше. Секретов в проекте нет; все обращения к бэкенду идут из браузера.

## Запуск

```bash
npm install
npm run dev      # http://localhost:3009
npm run build && npm run start
```

## Авторизация

- `POST /api/web/login` на voip backend (`NEXT_PUBLIC_VOIP_API_URL`) с `{ email, password }`.
- Войти может только пользователь с ролью `agent`.
- Сессия хранится в `localStorage` (`webAppUser`); `components/AuthGuard.tsx` редиректит неавторизованных на `/login`.

## Зависимости от бэкендов

**kedam_API** (`NEXT_PUBLIC_API_BASE_URL`):
- `/api/admin/*` — pages, home-sections, home-hotels, home-destinations, home-banners, home-hero, home-partners, faq, footer-social, callback-requests
- `/api/content/upload-image` — загрузка картинок из редактора
- `/user/orders?user_id=` , `/orders?order_id=`, `/orders/documents?order_id=`
- `/client/orders`, `/client/orders/:id` — прокси к Level Travel

**voip** (`NEXT_PUBLIC_VOIP_API_URL`):
- `/api/web/login`
- `/api/users`, `/api/users/:loyaltyId`, `/api/users/by-id/:id`, `PATCH /api/users/:id/access`

> **Внимание:** эндпоинты `/api/admin/*` на kedam_API сейчас не защищены JWT-guard'ом. Авторизация в админке — только на стороне фронта (localStorage), поэтому доступ к панели и к API должен ограничиваться на уровне сети / reverse proxy до тех пор, пока guard не появится на бэкенде.
