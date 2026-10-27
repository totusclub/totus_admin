'use client';

// Раздел «Операторы» — справочник наших операторов (Arlekino и будущие).
// Данные — totus_API `/api/admin/operators/*` (staff-JWT через lib/http.ts).
// Room Type ссылается на оператора по custom_room_types.operator_id; выбор оператора
// при создании и редактировании Room Type — в components/rooms/RuleForm.tsx.

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import PageShell from '@/components/PageShell';
import AdminNav from '@/components/AdminNav';
import { PageHeader, pageCard } from '@/components/PageKit';
import { getStaffAuth, staffLogout, staffDisplayName, type StaffAuth } from '@/lib/staff-auth-api';
import OperatorsTab from '@/components/operators/OperatorsTab';

export default function OperatorsPage() {
    const router = useRouter();
    const [authChecked, setAuthChecked] = useState(false);
    const [auth, setAuth] = useState<StaffAuth | null>(null);

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
                <PageHeader title="Операторы" subtitle={`Справочник наших операторов · Сотрудник: ${staffDisplayName(auth)}`} />

                <div style={{ minWidth: 0 }}>
                    <OperatorsTab />
                </div>
            </div>
        </PageShell>
    );
}
