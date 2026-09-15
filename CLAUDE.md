# Totus Admin — заметки для работы в репо

Админ-панель Totus Club (Next.js 14, App Router, TypeScript, без UI-библиотек — inline-стили).
Выделена из `calling_v2` 27.08.2026. Порт dev/start — **3009**.

## Где что лежит

| Путь | Назначение |
|------|------------|
| `app/layout.tsx` | корневой layout, оборачивает всё в `AuthGuard` |
| `app/page.tsx` | редирект `/` → `/users` |
| `app/login/` | форма входа агента |
| `app/users/` | пользователи (voip backend) |
| `app/orders/`, `app/orders/[orderId]/` | заказы и карточка заказа (kedam_API + Level Travel) |
| `app/lt-orders/` | заказы напрямую из Level Travel |
| `app/pages/`, `app/pages/[slug]/` | CMS-страницы футера сайта |
| `app/home-content/` | все секции главной страницы сайта |
| `app/callback-requests/` | заявки «Перезвоните мне» |
| `app/banners/`, `app/faq/`, `app/partners/` | редиректы на якоря `/home-content` |
| `app/notifications/`, `components/notifications/*`, `lib/push-api.ts` | раздел «Уведомления»: рассылки, правила напоминаний, история пушей — хаб `calling_api_v2` (`SERVER_BASE_URL/api/push/*`, staff-JWT), вкладки `?tab=campaigns|reminders|history` |
| `app/rooms/`, `app/rooms/hotel/[id]/`, `app/rooms/room-type/[id]/`, `components/rooms/*`, `lib/rooms-api.ts` | раздел «Отели и номера»: поиск отелей Level.Travel, наши Room Type поверх предложений LT (мастер на основе номера, v2: связь по выбранному номеру LT без обязательного оператора, режим цены — фиксированная цена Arlekino `pricingMode='fixed'` по умолчанию | правило от цены LT, название оператора; фото, история цен), настройки — totus_API `API_BASE_URL/api/admin/rooms/*` (staff-JWT), вкладки `?tab=hotels|room-types|bookings|settings`; требует миграции custom_rooms на сервере (иначе `503 custom_rooms_not_migrated`). Вкладка «Бронирования» + `app/rooms/booking/[id]/` (`components/rooms/BookingsTab.tsx`, `ConfirmBookingDialog.tsx`, `RejectBookingDialog.tsx`, `BookingStatusBadge.tsx`) — заказы наших Room Type без Level.Travel: `/api/admin/rooms/bookings/*`; возврат только вручную, таймера/автоотклонения нет («ожидает N ч» — с момента оплаты); ПД клиента показываем, в URL/логи не выносим |
| `components/AdminNav.tsx` | верхняя навигация; последний пункт — внешняя ссылка на calling.totus.club |
| `components/AuthGuard.tsx` | клиентская проверка сессии (`localStorage.webAppUser`, role === 'agent') |
| `components/PageShell.tsx` | обёртка страницы с фоном |
| `components/RichTextEditor.tsx` | contentEditable-редактор для CMS-страниц |
| `components/admin/home/*` | секции главной (hero/баннеры, контент, партнёры, FAQ, соцсети) + общие стили |
| `lib/server.ts` | **единственное** место с base URL: `SERVER_BASE_URL` (voip), `API_BASE_URL` (kedam_API) |
| `lib/auth-api.ts`, `lib/users-api.ts` | voip backend |
| `lib/orders-api.ts` | заказы, Level Travel, хелперы форматирования (`ORDERS_BASE_URL` = alias `API_BASE_URL`) |
| `lib/pages-api.ts`, `lib/home-*-api.ts`, `lib/faq-api.ts`, `lib/footer-social-api.ts`, `lib/callback-requests-api.ts` | kedam_API `/api/admin/*` |
| `lib/footer-pages-catalog.ts` | статичный каталог 11 страниц футера |

## Правила

1. **Не выдумывать endpoints.** Используем только те, что уже есть в `lib/*-api.ts` и описаны в README. Нужен новый — сначала он появляется в kedam_API / voip, потом здесь.
2. **Секреты и URL — только через env.** Base URL берём из `lib/server.ts` (`NEXT_PUBLIC_VOIP_API_URL`, `NEXT_PUBLIC_API_BASE_URL`). Никаких литералов `https://api.totus.club` / `https://voip.totus.club` в коде. Токенов и паролей в репо нет и быть не должно; `.env*` в `.gitignore`.
3. **Звонки живут в `calling_v2`.** Сюда не добавляем WebRTC, socket.io-логику, `CallModal`, `GlobalCallManager`, `webrtc-service`. В навигации — только внешняя ссылка на https://calling.totus.club.
4. **Коммиты — в ветки `claude/*`**, затем PR в `main`. Напрямую в `main` не пушим.
5. Стили — inline, как в существующем коде; общие стили секций — в `components/admin/home/styles.ts`. Новые страницы оборачиваем в `PageShell` + `AdminNav`.

## Запуск

```bash
npm install
cp .env.example .env.local   # при необходимости
npm run dev                  # :3009
npm run build                # проверка перед PR
```
