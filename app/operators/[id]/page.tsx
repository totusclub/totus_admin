'use client';

// Редактирование оператора: /operators/[id].

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import PageShell from '@/components/PageShell';
import AdminNav from '@/components/AdminNav';
import { text, cardStyle } from '@/lib/theme';
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

            <div style={cardStyle}>
                <Breadcrumbs items={[{ label: 'Операторы', onClick: () => router.push('/operators') }, { label: operator ? operator.name : '…' }]} />

                <div style={{ margin: '12px 0 20px' }}>
                    <h1 style={{ ...text.pageTitle, margin: '0 0 6px' }}>{operator ? operator.name : 'Оператор'}</h1>
                    {operator ? (
                        <div style={{ ...text.caption, fontWeight: 500 }}>
                            operator_id {operator.operatorId}
                            {operator.createdBy ? ` · создал: ${operator.createdBy}` : ''}
                        </div>
                    ) : null}
                </div>

                <ErrorBox message={error} />
                {loading && !operator ? <Spinner label="Загружаем оператора" /> : null}
                {operator ? <OperatorEditor operator={operator} onReload={load} /> : null}
            </div>
        </PageShell>
    );
}
