'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { isStaffAuthenticated } from '@/lib/staff-auth-api';
import { installStaffFetch } from '@/lib/http';

// Единый staff-вход (SECURITY_JWT_PLAN_RU.md, волна 2): сессия — staffAuth
// из totus_API; все запросы к API и voip получают Bearer через lib/http.ts.
export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    installStaffFetch();
  }, []);

  useEffect(() => {
    // Check authentication on route change
    if (pathname !== '/login') {
      if (!isStaffAuthenticated()) {
        router.push('/login');
      }
    } else {
      // If on login page and already authenticated, redirect to home
      if (isStaffAuthenticated()) {
        router.push('/');
      }
    }
  }, [pathname, router]);

  return <>{children}</>;
}
