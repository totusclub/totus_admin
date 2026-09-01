// Staff authentication for the totus_API backend (API_BASE_URL, api.totus.club).
//
// Единый вход в админку (SECURITY_JWT_PLAN_RU.md, волна 2): сотрудники — таблица
// `staff` в базе kedam. Агентский логин звонков (lib/auth-api.ts, voip) в админке
// больше не используется — voip принимает staff-токен (тот же JWT_SECRET).
//
// Токены (payload содержит scope: 'staff'):
//   - access JWT живёт 12 часов, refresh — 30 дней;
//   - POST /api/admin/auth/sign-in { email, password }
//       → { accessToken, refreshToken, id, name, lastname, email, role }
//   - POST /api/admin/auth/refresh { token: <refreshToken> }
//       → { accessToken }  (возвращается ТОЛЬКО новый access-токен,
//         refresh-токен остаётся прежним; 401/403 — refresh невалиден)
//
// Всё хранится в localStorage под ключом 'staffAuth' как
// { accessToken, refreshToken, profile }.

import { API_BASE_URL } from './server';

const STORAGE_KEY = 'staffAuth';

export interface StaffProfile {
  id: number;
  name: string | null;
  lastname: string | null;
  email: string;
  role: string | null;
}

export interface StaffAuth {
  accessToken: string;
  refreshToken: string;
  profile: StaffProfile;
}

// Sign in as staff and persist tokens + profile in localStorage.
export async function staffSignIn(email: string, password: string): Promise<StaffAuth> {
  const response = await fetch(`${API_BASE_URL}/api/admin/auth/sign-in`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  if (!response.ok) {
    let message = 'Не удалось войти';
    try {
      const data = await response.json();
      if (data?.message) message = data.message;
    } catch {
      // non-JSON error body — keep the default message
    }
    if (response.status === 401) message = 'Неверный email или пароль';
    if (response.status === 429) message = 'Слишком много попыток входа, попробуйте через 15 минут';
    throw new Error(message);
  }

  const data = await response.json();
  const auth: StaffAuth = {
    accessToken: data.accessToken,
    refreshToken: data.refreshToken,
    profile: {
      id: data.id,
      name: data.name ?? null,
      lastname: data.lastname ?? null,
      email: data.email,
      role: data.role ?? null,
    },
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(auth));
  return auth;
}

// Read the stored staff session (null when absent or malformed).
export function getStaffAuth(): StaffAuth | null {
  try {
    if (typeof window === 'undefined') return null;
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.accessToken || !parsed?.refreshToken) return null;
    return parsed as StaffAuth;
  } catch {
    return null;
  }
}

// Есть ли staff-сессия (для AuthGuard). Срок access не проверяем —
// его продлит refresh при первом 401.
export function isStaffAuthenticated(): boolean {
  return getStaffAuth() !== null;
}

// Имя сотрудника для шапки/навигации.
export function staffDisplayName(auth: StaffAuth | null): string {
  if (!auth) return 'Сотрудник';
  const name = [auth.profile.name, auth.profile.lastname].filter(Boolean).join(' ').trim();
  return name || auth.profile.email || 'Сотрудник';
}

// Drop the staff session.
export function staffLogout(): void {
  localStorage.removeItem(STORAGE_KEY);
}

function storeAccessToken(accessToken: string): void {
  const auth = getStaffAuth();
  if (!auth) return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...auth, accessToken }));
}

async function refreshAccessToken(refreshToken: string): Promise<string> {
  const response = await fetch(`${API_BASE_URL}/api/admin/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: refreshToken }),
  });
  if (!response.ok) throw new Error('refresh_failed');
  const data = await response.json();
  if (!data?.accessToken) throw new Error('refresh_failed');
  return data.accessToken as string;
}

// Обновить access-токен по сохранённому refresh и записать его в сессию.
// Бросает Error('refresh_failed'), если сессии нет или refresh отклонён.
export async function refreshStaffAccessToken(): Promise<string> {
  const auth = getStaffAuth();
  if (!auth) throw new Error('refresh_failed');
  const accessToken = await refreshAccessToken(auth.refreshToken);
  storeAccessToken(accessToken);
  return accessToken;
}

// fetch() с Bearer access-токеном сотрудника.
// При 401 один раз пробует обновить access-токен по refresh-токену и повторяет
// исходный запрос; если refresh тоже не удался — чистит staffAuth и бросает
// Error('staff_session_expired') (страница должна отправить на /login).
export async function authFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const auth = getStaffAuth();
  if (!auth) throw new Error('staff_session_expired');

  const doFetch = (accessToken: string) =>
    fetch(input, {
      ...init,
      headers: {
        ...(init.headers || {}),
        Authorization: `Bearer ${accessToken}`,
      },
    });

  const response = await doFetch(auth.accessToken);
  if (response.status !== 401) return response;

  // Access-токен истёк (12h) — пробуем refresh ровно один раз.
  let newAccessToken: string;
  try {
    newAccessToken = await refreshStaffAccessToken();
  } catch {
    staffLogout();
    throw new Error('staff_session_expired');
  }
  return doFetch(newAccessToken);
}
