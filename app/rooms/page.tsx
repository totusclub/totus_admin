'use client';

// Раздел «Отели и номера»: поиск отелей Level.Travel, наши Room Type и настройки.
// Данные — totus_API `/api/admin/rooms/*` (staff-JWT через lib/http.ts). Вкладки `?tab=hotels|room-types|bookings|settings`.
// «Бронирования» — заказы наших Room Type без Level.Travel (подтверждает/отклоняет сотрудник); в подписи вкладки — число ожидающих.

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import PageShell from '@/components/PageShell';
import AdminNav from '@/components/AdminNav';
import { PageHeader, pageCard } from '@/components/PageKit';
import { getStaffAuth, staffLogout, staffDisplayName, type StaffAuth } from '@/lib/staff-auth-api';
import HotelsTab from '@/components/rooms/HotelsTab';
import RoomTypesTab from '@/components/rooms/RoomTypesTab';
import SettingsTab from '@/components/rooms/SettingsTab';
import BookingsTab from '@/components/rooms/BookingsTab';
import { getBookingsSummary, type BookingsSummary } from '@/lib/rooms-api';
import { TabPills } from '@/components/rooms/shared';

type Tab = 'hotels' | 'room-types' | 'bookings' | 'settings';

const TABS: { value: Tab; label: string }[] = [
    { value: 'hotels', label: 'Отели' },
    { value: 'room-types', label: 'Наши Room Type' },
    { value: 'bookings', label: 'Бронирования' },
    { value: 'settings', label: 'Настройки' },
];

function RoomsContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [authChecked, setAuthChecked] = useState(false);
    const [auth, setAuth] = useState<StaffAuth | null>(null);

    const tabParam = searchParams.get('tab');
    const tab: Tab = tabParam === 'room-types' || tabParam === 'settings' || tabParam === 'bookings' ? tabParam : 'hotels';
    const [summary, setSummary] = useState<BookingsSummary | null>(null);
    const onSummary = useCallback((s: BookingsSummary) => setSummary(s), []);

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

    // Счётчик ожидающих бронирований в подписи вкладки (ошибку не показываем — вкладка сама её отдаст).
    useEffect(() => {
        if (!auth) return;
        getBookingsSummary().then(setSummary).catch(() => {});
    }, [auth]);

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

            <div style={pageCard}>
                <PageHeader
                    title="Отели и номера"
                    subtitle={
                        <>
                            {tab === 'bookings'
                                ? `Бронирования наших Room Type · ${summary?.pending ? `${summary.pending} ожидают подтверждения` : 'новых нет'}`
                                : 'Поиск отелей Level.Travel и наши Room Type'}{' '}
                            · Сотрудник: {staffDisplayName(auth)}
                        </>
                    }
                />

                <TabPills tabs={TABS.map((x) => (x.value === 'bookings' && summary?.pending ? { ...x, label: `Бронирования (${summary.pending})` } : x))} value={tab} onChange={setTab} />

                <div style={{ minWidth: 0 }}>
                    {tab === 'hotels' ? <HotelsTab initialParams={searchParams} /> : null}
                    {tab === 'room-types' ? <RoomTypesTab /> : null}
                    {tab === 'bookings' ? <BookingsTab onSummary={onSummary} /> : null}
                    {tab === 'settings' ? <SettingsTab /> : null}
                </div>
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
