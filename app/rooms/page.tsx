'use client';

// Раздел «Отели и номера»: поиск отелей Level.Travel, наши Room Type и настройки.
// Данные — totus_API `/api/admin/rooms/*` (staff-JWT через lib/http.ts). Вкладки `?tab=hotels|room-types|settings`.

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import PageShell from '@/components/PageShell';
import AdminNav from '@/components/AdminNav';
import Icon from '@/components/Icon';
import { t, text, cardStyle } from '@/lib/theme';
import { getStaffAuth, staffLogout, staffDisplayName, type StaffAuth } from '@/lib/staff-auth-api';
import HotelsTab from '@/components/rooms/HotelsTab';
import RoomTypesTab from '@/components/rooms/RoomTypesTab';
import SettingsTab from '@/components/rooms/SettingsTab';
import { TabPills } from '@/components/rooms/shared';

type Tab = 'hotels' | 'room-types' | 'settings';

const TABS: { value: Tab; label: string }[] = [
    { value: 'hotels', label: 'Отели' },
    { value: 'room-types', label: 'Наши Room Type' },
    { value: 'settings', label: 'Настройки' },
];

function RoomsContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [authChecked, setAuthChecked] = useState(false);
    const [auth, setAuth] = useState<StaffAuth | null>(null);

    const tabParam = searchParams.get('tab');
    const tab: Tab = tabParam === 'room-types' || tabParam === 'settings' ? tabParam : 'hotels';

    useEffect(() => {
        setAuth(getStaffAuth());
        setAuthChecked(true);
    }, []);

    useEffect(() => {
        if (authChecked && !auth) {
            staffLogout();
            router.replace('/login');
        }
    }, [authChecked, auth, router]);

    const setTab = (next: Tab) => {
        // При уходе с «Отелей» параметры поиска (в т.ч. request_id) остаются в URL — назад к той же выдаче.
        const p = new URLSearchParams(searchParams.toString());
        p.set('tab', next);
        router.replace(`/rooms?${p.toString()}`);
    };

    if (!authChecked || !auth) {
        return (
            <PageShell>
                <AdminNav />
            </PageShell>
        );
    }

    return (
        <PageShell>
            <AdminNav />

            <div style={cardStyle}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap', marginBottom: 18 }}>
                    <div>
                        <h1 style={{ ...text.pageTitle, margin: '0 0 6px', display: 'flex', alignItems: 'center', gap: 10 }}>
                            <Icon name="hotel" size={28} style={{ color: t.accent }} />
                            Отели и номера
                        </h1>
                        <div style={{ ...text.caption, fontWeight: 500 }}>
                            Поиск отелей Level.Travel и наши Room Type · Сотрудник: {staffDisplayName(auth)}
                        </div>
                    </div>
                </div>

                <div style={{ marginBottom: 20 }}>
                    <TabPills tabs={TABS} value={tab} onChange={setTab} />
                </div>

                {tab === 'hotels' ? <HotelsTab initialParams={searchParams} /> : null}
                {tab === 'room-types' ? <RoomTypesTab /> : null}
                {tab === 'settings' ? <SettingsTab /> : null}
            </div>
        </PageShell>
    );
}

// useSearchParams требует Suspense-границу при статической сборке Next 14.
export default function RoomsPage() {
    return (
        <Suspense
            fallback={
                <PageShell>
                    <AdminNav />
                </PageShell>
            }
        >
            <RoomsContent />
        </Suspense>
    );
}
