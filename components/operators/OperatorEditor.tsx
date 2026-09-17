'use client';

// Страница редактирования оператора: форма + блок «Где используется».
// Сохранение переписывает имя (и operator_id, если его поменяли) во всех Room Type оператора —
// backend возвращает roomTypesUpdated, показываем это сотруднику.

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ErrorBox, Modal, SuccessBox, compactInput } from '@/components/notifications/shared';
import { ConfirmDialog } from '@/components/rooms/shared';
import { badge, button, cardStyle, t, text } from '@/lib/theme';
import { deleteOperator, duplicateOperator, updateOperator, type Operator } from '@/lib/operators-api';
import OperatorForm, { bodyFromState, stateFromOperator, validateOperatorState, type OperatorFormState } from './OperatorForm';

function errText(e: unknown, fallback: string): string {
  return e instanceof Error && e.message ? e.message : fallback;
}

export default function OperatorEditor({ operator, onReload }: { operator: Operator; onReload: () => void }) {
  const router = useRouter();
  const [state, setState] = useState<OperatorFormState>(stateFromOperator(operator));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [duplicating, setDuplicating] = useState(false);
  const [dupName, setDupName] = useState(`${operator.name} (копия)`);
  const [removing, setRemoving] = useState(false);

  const used = operator.roomTypesCount ?? 0;

  const save = async () => {
    const invalid = validateOperatorState(state);
    if (invalid) {
      setError(invalid);
      return;
    }
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const { operator: saved, roomTypesUpdated } = await updateOperator(operator.id, bodyFromState(state));
      setNotice(
        roomTypesUpdated
          ? `Сохранено. Обновлено Room Type: ${roomTypesUpdated} — на витрине они теперь подписаны «${saved.name}».`
          : 'Сохранено.',
      );
      onReload();
    } catch (e) {
      setError(errText(e, 'Не удалось сохранить оператора'));
    } finally {
      setBusy(false);
    }
  };

  const onDuplicate = async () => {
    setBusy(true);
    setError(null);
    try {
      const copy = await duplicateOperator(operator.id, { name: dupName.trim() || undefined, copyEmails: true });
      setDuplicating(false);
      router.push(`/operators/${copy.id}`);
    } catch (e) {
      setError(errText(e, 'Не удалось дублировать оператора'));
    } finally {
      setBusy(false);
    }
  };

  const onRemove = async () => {
    setBusy(true);
    setError(null);
    try {
      await deleteOperator(operator.id);
      router.push('/operators');
    } catch (e) {
      setError(errText(e, 'Не удалось удалить оператора'));
      setRemoving(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <ErrorBox message={error} />
      <SuccessBox message={notice} />

      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 20, flexWrap: 'wrap' }}>
        <div style={{ ...cardStyle, flex: '1 1 520px', minWidth: 420, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ ...text.sectionTitle }}>Основное</div>
          <OperatorForm
            value={state}
            onChange={setState}
            disabled={busy}
            idHint={
              used
                ? `Уже используется в ${used} Room Type — при смене id все они переедут на новый автоматически.`
                : undefined
            }
          />

          <div style={{ height: 1, background: t.border }} />

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <button type="button" style={button('primary', 'md')} disabled={busy} onClick={save}>
              Сохранить
            </button>
            <button type="button" style={button('tertiary', 'md')} disabled={busy} onClick={() => setDuplicating(true)}>
              Дублировать
            </button>
            <div style={{ flex: 1 }} />
            <button
              type="button"
              style={button('danger', 'md')}
              disabled={busy || used > 0}
              title={used > 0 ? 'За оператором закреплены Room Type — сначала переведите их на другого' : undefined}
              onClick={() => setRemoving(true)}
            >
              Удалить
            </button>
          </div>
        </div>

        <div style={{ ...cardStyle, flex: '0 1 360px', minWidth: 300, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ ...text.sectionTitle }}>Где используется</div>

          <div>
            <div style={{ ...text.caption }}>Room Type</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: t.textPrimary }}>{used}</div>
            <div style={{ ...text.caption }}>
              {operator.activeRoomTypesCount ?? 0} активных — показываются на витрине
            </div>
          </div>

          <div>
            <div style={{ ...text.caption }}>operator_id на витрине</div>
            <div style={{ ...text.mono, fontSize: 22, fontWeight: 700, color: t.textPrimary }}>{operator.operatorId}</div>
            <div style={{ ...text.caption }}>по нему Room Type связаны с оператором</div>
          </div>

          <div>
            <div style={{ ...text.caption }}>Статус</div>
            <span style={badge(operator.active ? 'success' : 'neutral')}>{operator.active ? 'Активен' : 'Выключен'}</span>
          </div>

          <div style={{ height: 1, background: t.border }} />

          <div style={{ padding: '12px 14px', borderRadius: 12, background: t.accentSoft, color: t.textSecondary, fontSize: 12, lineHeight: 1.5 }}>
            Оператора нельзя удалить, пока за ним закреплён хотя бы один Room Type.
            Сначала переведите их на другого оператора в разделе «Отели и номера».
          </div>

          <button type="button" style={{ ...button('secondary', 'md'), width: '100%' }} onClick={() => router.push('/rooms?tab=room-types')}>
            Открыть Room Type
          </button>
        </div>
      </div>

      {duplicating ? (
        <Modal title="Дублировать оператора" onClose={() => setDuplicating(false)} width={520}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ ...text.caption }}>Копия получит новый operator_id и будет создана выключенной.</div>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, color: t.textSecondary }}>
              Название копии
              <input style={compactInput} value={dupName} onChange={(e) => setDupName(e.target.value)} maxLength={128} disabled={busy} />
            </label>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button type="button" style={button('tertiary', 'md')} disabled={busy} onClick={() => setDuplicating(false)}>
                Отмена
              </button>
              <button type="button" style={button('primary', 'md')} disabled={busy} onClick={onDuplicate}>
                Дублировать
              </button>
            </div>
          </div>
        </Modal>
      ) : null}

      {removing ? (
        <ConfirmDialog
          title="Удалить оператора"
          message={<>Оператор «{operator.name}» будет удалён. Room Type за ним не закреплены, поэтому витрина не изменится.</>}
          busy={busy}
          onConfirm={onRemove}
          onClose={() => setRemoving(false)}
        />
      ) : null}
    </div>
  );
}
