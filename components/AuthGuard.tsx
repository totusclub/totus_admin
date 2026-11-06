'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { isStaffAuthenticated } from '@/lib/staff-auth-api';
import { installStaffFetch } from '@/lib/http';

// Обёртка fetch с staff-Bearer ставится при загрузке модуля, до рендера дерева:
// эффекты дочерних компонентов (загрузка таблиц) выполняются раньше эффекта AuthGuard,
// и при жёсткой перезагрузке первые запросы уходили без токена — при AUTH_MODE=enforce
// в totus_API это пустые таблицы (SECURITY_ENFORCE_MATRIX_RU.md, п. 2). На сервере — no-op.
installStaffFetch();

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
