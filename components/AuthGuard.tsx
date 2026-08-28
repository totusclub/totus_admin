'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { getStaffAuth } from '@/lib/staff-auth-api';

// Единый гард админки: проверяет staff-сессию kedam_API (localStorage 'staffAuth').
// Агентский логин звонков ('webAppUser') больше не используется.
export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    // Check authentication on route change
    if (pathname !== '/login') {
      if (!getStaffAuth()) {
        router.push('/login');
      }
    } else {
      // If on login page and already authenticated, redirect to home
      if (getStaffAuth()) {
        router.push('/');
      }
    }
  }, [pathname, router]);

  return <>{children}</>;
}
