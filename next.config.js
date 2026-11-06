/** @type {import('next').NextConfig} */

/**
 * Заголовки безопасности (SECURITY_AUDIT_2026-11_RU.md, H8).
 * Админка никуда не встраивается, поэтому фреймы запрещены полностью (DENY / frame-ancestors 'none').
 * CSP по умолчанию в режиме Report-Only (CSP_MODE=report-only): браузер только пишет нарушения в консоль,
 * ничего не блокируя. После недели без ложных срабатываний — CSP_MODE=enforce. CSP_MODE=off — без CSP.
 * Дополнительные источники — CSP_EXTRA_SOURCES=https://a.example,https://b.example.
 * Адреса API берутся из тех же переменных, что и в lib/server.ts.
 */
function securityHeaders() {
  const mode = String(process.env.CSP_MODE || 'report-only').toLowerCase();
  const extra = String(process.env.CSP_EXTRA_SOURCES || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const apiHosts = [process.env.NEXT_PUBLIC_API_BASE_URL, process.env.NEXT_PUBLIC_VOIP_API_URL]
    .map((s) => String(s || '').trim().replace(/\/+$/, ''))
    .filter((s) => /^https?:\/\//.test(s));
  const connect = ["'self'", 'https://*.totus.club', 'wss://*.totus.club', ...apiHosts, ...extra].join(' ');
  const csp = [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline' ${extra.join(' ')}`.trim(),
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data: https://fonts.gstatic.com",
    `connect-src ${connect}`,
    "media-src 'self' blob: data: https:",
    "frame-src 'none'",
    "frame-ancestors 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "worker-src 'self' blob:",
  ].join('; ');
  const headers = [
    { key: 'X-Content-Type-Options', value: 'nosniff' },
    { key: 'X-Frame-Options', value: 'DENY' },
    { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
    { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()' },
    { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
    // Админка — служебный сайт: поисковикам и кэшам тут делать нечего.
    { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
  ];
  if (mode === 'enforce') headers.push({ key: 'Content-Security-Policy', value: csp });
  else if (mode !== 'off') headers.push({ key: 'Content-Security-Policy-Report-Only', value: csp });
  return headers;
}

const nextConfig = {
  reactStrictMode: true,
  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders(),
      },
    ];
  },
}

module.exports = nextConfig
