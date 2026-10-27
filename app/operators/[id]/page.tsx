'use client';

// Редактирование оператора: /operators/[id].

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import PageShell from '@/components/PageShell';
import AdminNav from '@/components/AdminNav';
import { PageHeader, pageCard } from '@/components/PageKit';
import { getStaffAuth, staffLogout, type StaffAuth } from '@/lib/staff-auth-api';
import { ErrorBox } from '@/components/notifications/shared';
import { Breadcrumbs, Spinner } from '@/components/rooms/shared';
import { getOperator, type Operator } from '@/lib/operators-api';
import OperatorEditor from '@/components/operators/OperatorEditor';

export default function OperatorPage() {
    const router = useRouter();
    const params = useParams<{ id: string }>();
    const id = Number(params?.id);

    const [authChecked, setAuthChecked] = useState(false);
    const [auth, setAuth] = useState<StaffAuth | null>(null);
    const [operator, setOperator] = useState<Operator | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

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

    const load = useCallback(async () => {
        if (!auth || !id) return;
        setLoading(true);
        setError(null);
        try {
            setOperator(await getOperator(id));
        } catch (e) {
            setError(e instanceof Error && e.message ? e.message : 'Не удалось загрузить оператора');
        } finally {
            setLoading(false);
        }
    }, [auth, id]);

    useEffect(() => {
        load();
    }, [load]);

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
                    before={<Breadcrumbs items={[{ label: 'Операторы', onClick: () => router.push('/operators') }, { label: operator ? operator.name : '…' }]} />}
                    title={operator ? operator.name : 'Оператор'}
                    subtitle={
                        operator
                            ? `operator_id ${operator.operatorId}${operator.createdBy ? ` · создал: ${operator.createdBy}` : ''}`
                            : undefined
                    }
                />

                <ErrorBox message={error} />
                {loading && !operator ? <Spinner label="Загружаем оператора" /> : null}
                {operator ? (
                    <div style={{ minWidth: 0 }}>
                        <OperatorEditor operator={operator} onReload={load} />
                    </div>
                ) : null}
            </div>
        </PageShell>
    );
}
