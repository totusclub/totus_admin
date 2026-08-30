import PageShell from '@/components/PageShell';
import AdminNav from '@/components/AdminNav';
import { text, cardStyle } from '@/lib/theme';

export default function BannersRedirectPage() {
    return (
        <PageShell>
            <AdminNav />

            <div style={cardStyle}>
                <h1 style={{ margin: 0, ...text.pageTitle }}>Баннеры</h1>
                <p style={{ margin: '12px 0 0', ...text.caption }}>
                    Раздел в разработке. Пока правится в блоке Hero на экране «Главная страница».
                </p>
            </div>
        </PageShell>
    );
}
