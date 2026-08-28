// DEPRECATED: агентский логин звонков (voip.totus.club, localStorage 'webAppUser').
// Админка больше НЕ использует этот модуль: единый вход теперь через
// staff JWT kedam_API — см. lib/staff-auth-api.ts (таблица `staff`, ключ 'staffAuth').
// Файл оставлен в репозитории только для истории — не импортировать его
// в новом коде.

// Authentication API service for web app
import {SERVER_BASE_URL} from './server';

const BASE_URL = SERVER_BASE_URL;

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface User {
  id: number;
  loyaltyId: string;
  name: string | null;
  fName: string | null;
  lName: string | null;
  email: string | null;
  phone: string | null;
  role: string;
}

export interface LoginResponse {
  ok: boolean;
  user: User;
}

/** @deprecated Единый вход админки — staffSignIn из lib/staff-auth-api.ts. */
// Login user (only agents can login)
export async function login(credentials: LoginCredentials): Promise<LoginResponse> {
  try {
    const response = await fetch(`${BASE_URL}/api/web/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(credentials),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Login failed');
    }

    const data = await response.json();
    return data;
  } catch (error: any) {
    console.error('Login error:', error);
    throw error;
  }
}

/** @deprecated Единый вход админки — getStaffAuth из lib/staff-auth-api.ts. */
// Get stored user from localStorage
export function getStoredUser(): User | null {
  try {
    const userStr = localStorage.getItem('webAppUser');
    if (!userStr) return null;
    return JSON.parse(userStr);
  } catch (error) {
    console.error('Error getting stored user:', error);
    return null;
  }
}

/** @deprecated Единый вход админки — staffSignIn из lib/staff-auth-api.ts. */
// Store user in localStorage
export function storeUser(user: User): void {
  localStorage.setItem('webAppUser', JSON.stringify(user));
}

/** @deprecated Единый вход админки — staffLogout из lib/staff-auth-api.ts. */
// Remove user from localStorage (logout)
export function removeUser(): void {
  localStorage.removeItem('webAppUser');
  localStorage.removeItem('webLoyaltyId');
}

/** @deprecated Единый вход админки — getStaffAuth из lib/staff-auth-api.ts. */
// Check if user is authenticated
export function isAuthenticated(): boolean {
  const user = getStoredUser();
  return user !== null && user.role === 'agent';
}
