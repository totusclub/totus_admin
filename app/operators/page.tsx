'use client';

// Раздел «Операторы» — справочник наших операторов (Arlekino и будущие).
// Данные — totus_API `/api/admin/operators/*` (staff-JWT через lib/http.ts).
// Room Type ссылается на оператора по custom_room_types.operator_id; выбор оператора
// при создании и редактировании Room Type — в components/rooms/RuleForm.tsx.

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import PageShell from '@/components/PageShell';
import AdminNav from '@/components/AdminNav';
import Icon from '@/components/Icon';
import { t, text, cardStyle } from '@/lib/theme';
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

            <div style={cardStyle}>
                <div style={{ marginBottom: 20 }}>
                    <h1 style={{ ...text.pageTitle, margin: '0 0 6px', display: 'flex', alignItems: 'center', gap: 10 }}>
                        <Icon name="list" size={28} style={{ color: t.accent }} />
                        Операторы
                    </h1>
                    <div style={{ ...text.caption, fontWeight: 500 }}>
                        Справочник наших операторов · Сотрудник: {staffDisplayName(auth)}
                    </div>
                </div>

                <OperatorsTab />
            </div>
        </PageShell>
    );
}
