'use client';

// Отель из выдачи Level.Travel: номера по операторам, наши Room Type, история цен.
// URL: /rooms/hotel/[id]?request_id=&name=&hotel_stars=&city=&start_date=&nights=&adults=&kids=&from_city=&to_country=&to_city=&stars=&q=
// (параметры поиска нужны, чтобы вернуться к той же выдаче кнопкой «Изменить даты»).

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import PageShell from '@/components/PageShell';
import AdminNav from '@/components/AdminNav';
import { t, text, cardStyle, button } from '@/lib/theme';
import { getStaffAuth, staffLogout, type StaffAuth } from '@/lib/staff-auth-api';
import { ErrorBox, SuccessBox } from '@/components/notifications/shared';
import { getHotelRooms, toggleRoomType, type HotelRoomsResult, type OperatorGroup, type OperatorRoom, type RoomType } from '@/lib/rooms-api';
import OperatorGroups from '@/components/rooms/OperatorGroups';
import RoomTypeCard from '@/components/rooms/RoomTypeCard';
import RoomTypeWizard from '@/components/rooms/RoomTypeWizard';
import DuplicateDialog from '@/components/rooms/DuplicateDialog';
import PriceHistory from '@/components/rooms/PriceHistory';
import { Breadcrumbs, Stars, TabPills, Empty, Spinner, searchSummary } from '@/components/rooms/shared';

type View = 'rooms' | 'room-types' | 'history';

function HotelContent() {
    const router = useRouter();
    const params = useParams<{ id: string }>();
    const sp = useSearchParams();
    const hotelId = Number(params?.id);
    const requestId = sp.get('request_id') || '';
    const hotelName = sp.get('name') || `Отель #${hotelId}`;
    const hotelStars = Number(sp.get('hotel_stars')) || 0;
    const hotelCity = sp.get('city') || '';
    const nights = Number(sp.get('nights')) || 0;
    const viewParam = sp.get('view');
    const view: View = viewParam === 'room-types' || viewParam === 'history' ? viewParam : 'rooms';

    const [authChecked, setAuthChecked] = useState(false);
    const [auth, setAuth] = useState<StaffAuth | null>(null);
    const [result, setResult] = useState<HotelRoomsResult | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [notice, setNotice] = useState<string | null>(null);
    const [busyId, setBusyId] = useState<number | null>(null);
    const [wizard, setWizard] = useState<{ room: OperatorRoom; group: OperatorGroup } | null>(null);
    const [duplicate, setDuplicate] = useState<RoomType | null>(null);

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
        if (!auth || !hotelId) return;
        if (!requestId) {
            setError('Нет активного поиска — откройте отель из выдачи на вкладке «Отели»');
            setLoading(false);
            return;
        }
        setLoading(true);
        setError(null);
        try {
            setResult(await getHotelRooms(hotelId, requestId));
        } catch (e: any) {
            setError(e?.message || 'Не удалось загрузить номера отеля');
        } finally {
            setLoading(false);
        }
    }, [auth, hotelId, requestId]);

    useEffect(() => {
        load();
    }, [load]);

    const summary = useMemo(
        () => searchSummary({ start_date: sp.get('start_date'), nights: sp.get('nights'), adults: sp.get('adults'), kids: sp.get('kids'), from_city: sp.get('from_city') }),
        [sp],
    );

    const backToSearch = () => {
        const p = new URLSearchParams(sp.toString());
        ['name', 'hotel_stars', 'city', 'view'].forEach((k) => p.delete(k));
        p.set('tab', 'hotels');
        router.push(`/rooms?${p.toString()}`);
    };

    const setView = (next: View) => {
        const p = new URLSearchParams(sp.toString());
        if (next === 'rooms') p.delete('view');
        else p.set('view', next);
        router.replace(`/rooms/hotel/${hotelId}?${p.toString()}`);
    };

    const editorUrl = (id: number) => {
        const p = new URLSearchParams(sp.toString());
        p.delete('view');
        return `/rooms/room-type/${id}?${p.toString()}`;
    };

    const onToggle = async (rt: RoomType, active: boolean) => {
        setBusyId(rt.id);
        setError(null);
        try {
            const next = await toggleRoomType(rt.id, active);
            // статус/preview по выдаче считает сервер — сразу показываем active, затем перечитываем
            setResult((r) => (r ? { ...r, room_types: r.room_types.map((x) => (x.id === next.id ? { ...x, active: next.active } : x)) } : r));
            await load();
        } catch (e: any) {
            setError(e?.message || 'Не удалось переключить');
        } finally {
            setBusyId(null);
        }
    };

    if (!authChecked || !auth) {
        return (
            <PageShell>
                <AdminNav />
            </PageShell>
        );
    }

    const roomTypes = result?.room_types || [];
    const operators = (result?.operators || []).map((g) => g.operator_name).filter(Boolean);
    const wizardOffers = wizard ? (result?.rooms || []).find((r) => Number(r.room?.id) === Number(wizard.room.room_id))?.offers || [] : [];

    const tabs: { value: View; label: string }[] = [
        { value: 'rooms', label: 'Номера Level.Travel' },
        { value: 'room-types', label: `Наши Room Type (${roomTypes.length})` },
        { value: 'history', label: 'История цен' },
    ];

    return (
        <PageShell>
            <AdminNav />

            <div style={{ display: 'grid', gap: 16 }}>
                <Breadcrumbs items={[{ label: 'Отели', onClick: backToSearch }, { label: hotelName }]} />

                <div style={{ ...cardStyle, display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                    <div style={{ flex: 1, minWidth: 260 }}>
                        <h1 style={{ ...text.pageTitle, fontSize: 28, lineHeight: '36px', margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                            {hotelName}
                            <Stars count={hotelStars} size={16} />
                        </h1>
                        <div style={text.body}>
                            {hotelCity || '—'}
                            {operators.length ? ` · Операторы: ${operators.join(', ')}` : ''}
                        </div>
                        <div style={{ ...text.body, color: t.textPrimary, marginTop: 4 }}>Даты поиска: {summary}</div>
                    </div>
                    <button type="button" onClick={backToSearch} style={button('secondary', 'md')}>Изменить даты</button>
                </div>

                <div style={cardStyle}>
                    <div style={{ marginBottom: 20 }}>
                        <TabPills tabs={tabs} value={view} onChange={setView} />
                    </div>

                    <div style={{ display: 'grid', gap: 12, marginBottom: error || notice ? 16 : 0 }}>
                        <ErrorBox message={error} />
                        <SuccessBox message={notice} />
                    </div>

                    {loading ? <Spinner label="Загружаем номера Level.Travel..." /> : null}

                    {!loading && result && view === 'rooms' ? (
                        <OperatorGroups
                            result={result}
                            nights={nights}
                            busyId={busyId}
                            onCreate={(room, group) => setWizard({ room, group })}
                            onEdit={(rt) => router.push(editorUrl(rt.id))}
                            onDuplicate={setDuplicate}
                            onToggle={onToggle}
                        />
                    ) : null}

                    {!loading && result && view === 'room-types' ? (
                        roomTypes.length ? (
                            <div style={{ display: 'grid', gap: 10 }}>
                                {roomTypes.map((rt) => (
                                    <RoomTypeCard key={rt.id} rt={rt} busy={busyId === rt.id} onEdit={() => router.push(editorUrl(rt.id))} onDuplicate={() => setDuplicate(rt)} onToggle={(active) => onToggle(rt, active)} />
                                ))}
                            </div>
                        ) : (
                            <Empty title="У отеля пока нет наших Room Type" hint="Откройте вкладку «Номера Level.Travel» и нажмите «Создать Room Type» у нужного номера" />
                        )
                    ) : null}

                    {!loading && result && view === 'history' ? <PriceHistory roomTypes={roomTypes} /> : null}

                    {!loading && !result && !error ? <Empty title="Нет данных" /> : null}
                </div>
            </div>

            {wizard && result ? (
                <RoomTypeWizard
                    hotel={{ id: hotelId, name: hotelName, stars: hotelStars, city: hotelCity }}
                    room={wizard.room.room}
                    offers={wizardOffers}
                    operatorId={wizard.group.operator_id}
                    operatorName={wizard.group.operator_name}
                    settings={result.settings}
                    nights={nights}
                    searchSummary={summary}
                    onClose={() => setWizard(null)}
                    onCreated={(rt) => {
                        setWizard(null);
                        setNotice(`Room Type «${rt.content?.nameRu}» создан`);
                        load();
                    }}
                />
            ) : null}

            {duplicate ? (
                <DuplicateDialog
                    roomType={duplicate}
                    onClose={() => setDuplicate(null)}
                    onDone={(copy, openEditor) => {
                        setDuplicate(null);
                        setNotice(`Копия «${copy.content?.nameRu}» создана (выключена)`);
                        if (openEditor) router.push(editorUrl(copy.id));
                        else load();
                    }}
                />
            ) : null}
        </PageShell>
    );
}

export default function HotelPage() {
    return (
        <Suspense
            fallback={
                <PageShell>
                    <AdminNav />
                </PageShell>
            }
        >
            <HotelContent />
        </Suspense>
    );
}
