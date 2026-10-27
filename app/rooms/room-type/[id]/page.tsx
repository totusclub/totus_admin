'use client';

// Редактирование Room Type: /rooms/room-type/[id]?request_id=&... (параметры поиска — как у страницы отеля,
// чтобы preview считался по актуальной выдаче и «Назад» вёл к тому же отелю).

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import PageShell from '@/components/PageShell';
import AdminNav from '@/components/AdminNav';
import { PageHeader, pageCard, space } from '@/components/PageKit';
import { getStaffAuth, staffLogout, type StaffAuth } from '@/lib/staff-auth-api';
import { ErrorBox } from '@/components/notifications/shared';
import { getRoomType, getRoomSettings, getHotelRooms, type LtOffer, type RoomSettings, type RoomType } from '@/lib/rooms-api';
import RoomTypeEditor from '@/components/rooms/RoomTypeEditor';
import { Breadcrumbs, BrandBadge, Spinner, roomTypeLabel, searchSummary } from '@/components/rooms/shared';

function EditorContent() {
    const router = useRouter();
    const params = useParams<{ id: string }>();
    const sp = useSearchParams();
    const id = Number(params?.id);
    const requestId = sp.get('request_id') || '';

    const [authChecked, setAuthChecked] = useState(false);
    const [auth, setAuth] = useState<StaffAuth | null>(null);
    const [roomType, setRoomType] = useState<RoomType | null>(null);
    const [settings, setSettings] = useState<RoomSettings | null>(null);
    const [offers, setOffers] = useState<LtOffer[] | undefined>(undefined);
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
            const [rt, s] = await Promise.all([getRoomType(id), getRoomSettings().catch(() => null)]);
            setRoomType(rt);
            setSettings(s);
            if (requestId) {
                // Актуальные предложения источника — для preview (ошибку выдачи не считаем фатальной).
                getHotelRooms(rt.hotelId, requestId)
                    .then((res) => setOffers((res.rooms || []).find((r) => Number(r.room?.id) === Number(rt.sourceRoomId))?.offers || []))
                    .catch(() => setOffers([]));
            }
        } catch (e: any) {
            setError(e?.message || 'Не удалось загрузить Room Type');
        } finally {
            setLoading(false);
        }
    }, [auth, id, requestId]);

    useEffect(() => {
        load();
    }, [load]);

    const summary = useMemo(
        () => (sp.get('start_date') ? searchSummary({ start_date: sp.get('start_date'), nights: sp.get('nights'), adults: sp.get('adults'), kids: sp.get('kids'), from_city: sp.get('from_city') }) : undefined),
        [sp],
    );

    const hotelUrl = (rt: RoomType, view?: string) => {
        const p = new URLSearchParams(sp.toString());
        if (!p.get('name') && rt.hotelName) p.set('name', rt.hotelName);
        if (!p.get('hotel_stars') && rt.hotelStars) p.set('hotel_stars', String(rt.hotelStars));
        if (!p.get('city') && rt.hotelCity) p.set('city', rt.hotelCity);
        if (view) p.set('view', view);
        else p.delete('view');
        return requestId ? `/rooms/hotel/${rt.hotelId}?${p.toString()}` : '/rooms?tab=room-types';
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

            <div style={{ display: 'grid', gap: space.page }}>
                {loading ? (
                    <div style={pageCard}>
                        <Spinner label="Загружаем Room Type..." />
                    </div>
                ) : null}

                {error ? <ErrorBox message={error} /> : null}

                {!loading && roomType ? (
                    <>
                        <div style={pageCard}>
                            <PageHeader
                                before={
                                    <Breadcrumbs
                                        items={[
                                            { label: 'Отели и номера', onClick: () => router.push('/rooms?tab=room-types') },
                                            { label: roomType.hotelName || `Отель #${roomType.hotelId}`, onClick: () => router.push(hotelUrl(roomType)) },
                                            { label: roomType.content?.nameRu || `Room Type #${roomType.id}` },
                                        ]}
                                    />
                                }
                                title={
                                    <>
                                        <BrandBadge label={roomType.badge} />
                                        {roomType.content?.nameRu}
                                    </>
                                }
                                subtitle={
                                    <>
                                        {roomType.pricingMode === 'fixed' ? 'цена' : 'правило'} {roomTypeLabel(roomType)} · {roomType.operatorName || 'Arlekino'} · у номера «{roomType.sourceRoomName || roomType.sourceRoomId}»
                                    </>
                                }
                            />
                        </div>
                        <RoomTypeEditor
                            roomType={roomType}
                            settings={settings}
                            offers={offers}
                            nights={Number(sp.get('nights')) || undefined}
                            searchSummary={summary}
                            onSaved={setRoomType}
                            onDeleted={() => router.push(hotelUrl(roomType))}
                            onDuplicated={(copy, openEditor) => {
                                if (openEditor) router.push(`/rooms/room-type/${copy.id}?${sp.toString()}`);
                                else router.push(hotelUrl(roomType, 'room-types'));
                            }}
                        />
                    </>
                ) : null}
            </div>
        </PageShell>
    );
}

export default function RoomTypePage() {
    return (
        <Suspense
            fallback={
                <PageShell>
                    <AdminNav />
                </PageShell>
            }
        >
            <EditorContent />
        </Suspense>
    );
}
