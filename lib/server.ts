// Base URLs for the two backends the admin panel talks to.
// Both can be overridden via NEXT_PUBLIC_* env vars (see .env.example).
export const SERVER_BASE_URL = process.env.NEXT_PUBLIC_VOIP_API_URL || 'https://voip.totus.club';
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'https://api.totus.club';
