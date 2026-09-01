// Глобальный Bearer для админки (SECURITY_JWT_PLAN_RU.md, волна 2, п. 2.5).
//
// Оборачивает window.fetch один раз: ко всем запросам на API_BASE_URL (totus_API)
// и SERVER_BASE_URL (voip, calling_api_v2) добавляется `Authorization: Bearer <staff access>`.
// Staff-токен выдаёт totus_API; calling_api_v2 проверяет его тем же JWT_SECRET
// (роль staff пропускается на /api/users и /api/users/:id/access).
// На 401 — один refresh (общий для параллельных запросов) и повтор;
// если refresh не удался — сессия чистится и открывается /login.
//
// Явный authFetch из staff-auth-api продолжает работать (заголовок не дублируется).
import { API_BASE_URL, SERVER_BASE_URL } from './server';
import { getStaffAuth, refreshStaffAccessToken, staffLogout } from './staff-auth-api';

const AUTH_ENDPOINTS = ['/api/admin/auth/sign-in', '/api/admin/auth/refresh'];

let installed = false;
let refreshPromise: Promise<string | null> | null = null;

function urlOf(input: RequestInfo | URL): string {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.toString();
  return input.url;
}

function needsToken(url: string): boolean {
  const bases = [API_BASE_URL, SERVER_BASE_URL].map((b) => b.replace(/\/+$/, ''));
  if (!bases.some((b) => url.startsWith(b))) return false;
  return !AUTH_ENDPOINTS.some((p) => url.includes(p));
}

async function refreshOnce(): Promise<string | null> {
  if (!refreshPromise) {
    refreshPromise = refreshStaffAccessToken()
      .catch(() => null)
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

export function installStaffFetch(): void {
  if (installed || typeof window === 'undefined') return;
  installed = true;

  const nativeFetch = window.fetch.bind(window);

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = urlOf(input);
    if (!needsToken(url)) return nativeFetch(input, init);

    const withToken = (token: string): RequestInit => {
      const headers = new Headers(init?.headers || (input instanceof Request ? input.headers : undefined));
      if (!headers.has('Authorization')) headers.set('Authorization', `Bearer ${token}`);
      return { ...(init || {}), headers };
    };

    const auth = getStaffAuth();
    if (!auth) return nativeFetch(input, init);

    let response = await nativeFetch(input, withToken(auth.accessToken));
    if (response.status !== 401) return response;

    const nextToken = await refreshOnce();
    if (nextToken) {
      response = await nativeFetch(input, withToken(nextToken));
      if (response.status !== 401) return response;
    }

    staffLogout();
    if (window.location.pathname !== '/login') window.location.href = '/login';
    return response;
  };
}
