import PageShell from '@/components/PageShell';
import AdminNav from '@/components/AdminNav';
import { text, cardStyle } from '@/lib/theme';

export default function FaqRedirectPage() {
    return (
        <PageShell>
            <AdminNav />

            <div style={cardStyle}>
                <h1 style={{ margin: 0, ...text.pageTitle }}>Вопросы и ответы</h1>
                <p style={{ margin: '12px 0 0', ...text.caption }}>
                    Раздел в разработке. Пока правится на экране «Главная страница».
                </p>
            </div>
        </PageShell>
    );
}
