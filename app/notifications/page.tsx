'use client';

// Раздел «Уведомления»: рассылки, правила напоминаний и история пушей.
// Данные — хаб уведомлений calling_api_v2 (`/api/push/*`, staff-JWT через lib/http.ts).

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import PageShell from '@/components/PageShell';
import AdminNav from '@/components/AdminNav';
import { PageHeader, pageCard } from '@/components/PageKit';
import { TabPills } from '@/components/rooms/shared';
import { getStaffAuth, staffLogout, type StaffAuth } from '@/lib/staff-auth-api';
import { getPushStatus, type PushStatusInfo } from '@/lib/push-api';
import CampaignsTab from '@/components/notifications/CampaignsTab';
import RemindersTab from '@/components/notifications/RemindersTab';
import HistoryTab from '@/components/notifications/HistoryTab';
import { ErrorBox } from '@/components/notifications/shared';

type Tab = 'campaigns' | 'reminders' | 'history';

const TABS: { value: Tab; label: string }[] = [
    { value: 'campaigns', label: 'Рассылки' },
    { value: 'reminders', label: 'Напоминания' },
    { value: 'history', label: 'История' },
];

function quietHoursText(status: PushStatusInfo | null): string {
    const q = status?.quietHours;
    if (!q) return 'тихие часы 21:00–09:00';
    if (typeof q === 'string') return `тихие часы ${q}`;
    if (q.from && q.to) return `тихие часы ${q.from}–${q.to}`;
    return 'тихие часы 21:00–09:00';
}

function NotificationsContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [authChecked, setAuthChecked] = useState(false);
    const [auth, setAuth] = useState<StaffAuth | null>(null);
    const [status, setStatus] = useState<PushStatusInfo | null>(null);
    const [statusError, setStatusError] = useState<string | null>(null);

    const tabParam = searchParams.get('tab');
    const tab: Tab = tabParam === 'reminders' || tabParam === 'history' ? tabParam : 'campaigns';

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

    useEffect(() => {
        if (!auth) return;
        getPushStatus()
            .then((s) => {
                setStatus(s);
                setStatusError(null);
            })
            .catch((e: any) => setStatusError(e?.message || 'Уведомления временно недоступны'));
    }, [auth]);

    const setTab = (next: Tab) => {
        router.replace(next === 'campaigns' ? '/notifications' : `/notifications?tab=${next}`);
    };

    if (!authChecked || !auth) {
        return (
            <PageShell>
                <AdminNav />
            </PageShell>
        );
    }

    const staffEmail = auth.profile?.email || '';
    const onOff = (v: boolean | undefined) => (v ? 'вкл' : 'выкл');

    return (
        <PageShell>
            <AdminNav />

            <div style={pageCard}>
                <PageHeader
                    title="Уведомления"
                    subtitle={
                        status
                            ? `FCM: ${onOff(status.fcm)} · Web Push: ${onOff(status.webpush)} · ${quietHoursText(status)}`
                            : statusError
                                ? 'Статус хаба недоступен'
                                : 'Проверяем статус хаба...'
                    }
                />

                <ErrorBox message={statusError} />

                <TabPills tabs={TABS} value={tab} onChange={setTab} />

                <div style={{ minWidth: 0 }}>
                    {tab === 'campaigns' ? <CampaignsTab staffEmail={staffEmail} /> : null}
                    {tab === 'reminders' ? <RemindersTab staffEmail={staffEmail} /> : null}
                    {tab === 'history' ? <HistoryTab /> : null}
                </div>
            </div>
        </PageShell>
    );
}

// useSearchParams требует Suspense-границу при статической сборке Next 14.
export default function NotificationsPage() {
    return (
        <Suspense
            fallback={
                <PageShell>
                    <AdminNav />
                </PageShell>
            }
        >
            <NotificationsContent />
        </Suspense>
    );
}
