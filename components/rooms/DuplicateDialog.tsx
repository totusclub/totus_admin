'use client';

// Модал «Дублировать Room Type» → POST /room-types/:id/duplicate (копия создаётся выключенной).

import { useState } from 'react';
import { button } from '@/lib/theme';
import { Modal, Field, ErrorBox, compactInput, checkboxRow } from '@/components/notifications/shared';
import { duplicateRoomType, type RoomType } from '@/lib/rooms-api';

export default function DuplicateDialog({
    roomType,
    onClose,
    onDone,
}: {
    roomType: RoomType;
    onClose: () => void;
    /** Вызывается после создания копии; openEditor — открыть редактор копии. */
    onDone: (copy: RoomType, openEditor: boolean) => void;
}) {
    const [name, setName] = useState(`${roomType.content?.nameRu || 'Room Type'} (копия)`);
    const [copyContent, setCopyContent] = useState(true);
    const [copyRule, setCopyRule] = useState(true);
    const [images, setImages] = useState<'same' | 'none'>('same');
    const [openEditor, setOpenEditor] = useState(true);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const submit = async () => {
        setBusy(true);
        setError(null);
        try {
            const copy = await duplicateRoomType(roomType.id, { name: name.trim() || undefined, copyContent, copyRule, images });
            onDone(copy, openEditor);
        } catch (e: any) {
            setError(e?.message || 'Не удалось дублировать Room Type');
            setBusy(false);
        }
    };

    return (
        <Modal title="Дублировать Room Type" onClose={onClose}>
            <div style={{ display: 'grid', gap: 14 }}>
                <Field label="Название копии">
                    <input style={compactInput} value={name} onChange={(e) => setName(e.target.value)} maxLength={255} />
                </Field>
                <label style={checkboxRow}>
                    <input type="checkbox" checked={copyContent} onChange={(e) => setCopyContent(e.target.checked)} />
                    Скопировать контент (иначе — исходный контент Level.Travel)
                </label>
                <label style={checkboxRow}>
                    <input type="checkbox" checked={copyRule} onChange={(e) => setCopyRule(e.target.checked)} />
                    Скопировать правило цены (иначе — 0 %)
                </label>
                <Field label="Фотографии">
                    <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                        <label style={checkboxRow}>
                            <input type="radio" checked={images === 'same'} onChange={() => setImages('same')} />
                            Использовать те же
                        </label>
                        <label style={checkboxRow}>
                            <input type="radio" checked={images === 'none'} onChange={() => setImages('none')} />
                            Заменить после создания
                        </label>
                    </div>
                </Field>
                <label style={checkboxRow}>
                    <input type="checkbox" checked={openEditor} onChange={(e) => setOpenEditor(e.target.checked)} />
                    Открыть редактор после создания
                </label>
                <ErrorBox message={error} />
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                    <button type="button" onClick={onClose} style={button('secondary', 'md')}>Отмена</button>
                    <button type="button" onClick={submit} disabled={busy} style={{ ...button('primary', 'md'), opacity: busy ? 0.6 : 1 }}>
                        {busy ? 'Создаём...' : 'Дублировать'}
                    </button>
                </div>
            </div>
        </Modal>
    );
}
