'use client';

// Список операторов: создание, редактирование (отдельная страница), дублирование,
// включение/выключение и удаление. Данные — lib/operators-api.ts (`/api/admin/operators`).
// Связь с Room Type — по custom_room_types.operator_id, поэтому в таблице видно,
// сколько Room Type закреплено за оператором: пока их больше нуля, удалить нельзя.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ErrorBox, Modal, SuccessBox, compactInput } from '@/components/notifications/shared';
import { ConfirmDialog, Empty, Spinner, TableWrap, tableStyle, tdStyle, tdRight, thStyle, thRight, useDebounced } from '@/components/rooms/shared';
import { badge, button, t, text } from '@/lib/theme';
import {
  createOperator,
  deleteOperator,
  duplicateOperator,
  listOperators,
  toggleOperator,
  OPERATOR_ID_BASE,
  type Operator,
  type OperatorsList,
} from '@/lib/operators-api';
import OperatorForm, { bodyFromState, emptyOperatorState, validateOperatorState, type OperatorFormState } from './OperatorForm';

function errText(e: unknown, fallback: string): string {
  return e instanceof Error && e.message ? e.message : fallback;
}

export default function OperatorsTab() {
  const router = useRouter();
  const [data, setData] = useState<OperatorsList | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const query = useDebounced(q, 300);

  const [creating, setCreating] = useState<OperatorFormState | null>(null);
  const [duplicating, setDuplicating] = useState<Operator | null>(null);
  const [dupName, setDupName] = useState('');
  const [dupCopyEmails, setDupCopyEmails] = useState(true);
  const [removing, setRemoving] = useState<Operator | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await listOperators());
    } catch (e) {
      setError(errText(e, 'Не удалось загрузить операторов'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const operators = data?.operators || [];
  const visible = useMemo(() => {
    const s = query.trim().toLowerCase();
    if (!s) return operators;
    return operators.filter((o) => o.name.toLowerCase().includes(s) || String(o.operatorId).includes(s));
  }, [operators, query]);

  /** Оптимистично подменяем строку — список не перезапрашиваем на каждое действие. */
  const patch = (op: Operator) => {
    setData((prev) => (prev ? { ...prev, operators: prev.operators.map((x) => (x.id === op.id ? { ...x, ...op } : x)) } : prev));
  };

  const onToggle = async (op: Operator) => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      patch(await toggleOperator(op.id, !op.active));
      setNotice(op.active ? `Оператор «${op.name}» выключен` : `Оператор «${op.name}» включён`);
    } catch (e) {
      setError(errText(e, 'Не удалось переключить оператора'));
    } finally {
      setBusy(false);
    }
  };

  const onCreate = async () => {
    if (!creating) return;
    const invalid = validateOperatorState(creating);
    if (invalid) {
      setError(invalid);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const op = await createOperator(bodyFromState(creating));
      setCreating(null);
      setNotice(`Оператор «${op.name}» создан · operator_id ${op.operatorId}`);
      await load();
    } catch (e) {
      setError(errText(e, 'Не удалось создать оператора'));
    } finally {
      setBusy(false);
    }
  };

  const onDuplicate = async () => {
    if (!duplicating) return;
    setBusy(true);
    setError(null);
    try {
      const op = await duplicateOperator(duplicating.id, { name: dupName.trim() || undefined, copyEmails: dupCopyEmails });
      setDuplicating(null);
      setNotice(`Копия «${op.name}» создана · operator_id ${op.operatorId}. Она выключена — включите, когда проверите настройки.`);
      await load();
    } catch (e) {
      setError(errText(e, 'Не удалось дублировать оператора'));
    } finally {
      setBusy(false);
    }
  };

  const onRemove = async () => {
    if (!removing) return;
    setBusy(true);
    setError(null);
    try {
      await deleteOperator(removing.id);
      const name = removing.name;
      setRemoving(null);
      setNotice(`Оператор «${name}» удалён`);
      await load();
    } catch (e) {
      setError(errText(e, 'Не удалось удалить оператора'));
    } finally {
      setBusy(false);
    }
  };

  if (loading && !data) return <Spinner label="Загружаем операторов" />;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <ErrorBox message={error} />
      <SuccessBox message={notice} />

      {data && !data.available ? (
        <div style={{ padding: '14px 16px', borderRadius: 12, background: t.accentSoft, color: t.textSecondary, fontSize: 13, lineHeight: 1.5 }}>
          Справочник операторов ещё не создан на сервере. Нужно выполнить миграцию
          (<code style={{ ...text.mono }}>npm run migrate:operators</code>) и перезапустить API.
          До этого Room Type работают как раньше — с именем оператора, записанным в самой строке.
        </div>
      ) : null}

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <input
          style={{ ...compactInput, width: 300 }}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Поиск по названию или operator_id"
        />
        <div style={{ flex: 1 }} />
        <button
          type="button"
          style={button('primary', 'md')}
          disabled={busy || !data?.available}
          onClick={() => {
            setError(null);
            setNotice(null);
            setCreating(emptyOperatorState(data?.suggestedOperatorId || OPERATOR_ID_BASE));
          }}
        >
          Новый оператор
        </button>
      </div>

      <div style={{ padding: '12px 16px', borderRadius: 12, background: t.accentSoft, color: t.textSecondary, fontSize: 13, lineHeight: 1.5 }}>
        operator_id выдаётся автоматически из диапазона {OPERATOR_ID_BASE} и выше — так наши операторы не пересекаются
        с операторами Level.Travel. Значение можно изменить вручную, оно должно быть уникальным.
      </div>

      {!visible.length ? (
        <Empty
          title={operators.length ? 'Ничего не найдено' : 'Операторов пока нет'}
          hint={operators.length ? 'Измените поиск' : 'Создайте первого оператора — на него можно будет переключить Room Type.'}
        />
      ) : (
        <TableWrap>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>Оператор</th>
                <th style={thStyle}>operator_id</th>
                <th style={thRight}>Room Type</th>
                <th style={thRight}>Порядок</th>
                <th style={thStyle}>Почта бронирований</th>
                <th style={thStyle}>Статус</th>
                <th style={thRight}>Действия</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((op) => (
                <tr key={op.id}>
                  <td style={tdStyle}>
                    <div style={{ fontWeight: 600 }}>{op.name}</div>
                    {op.createdBy ? <div style={{ ...text.caption }}>создал: {op.createdBy}</div> : null}
                  </td>
                  <td style={{ ...tdStyle, ...text.mono }}>{op.operatorId}</td>
                  <td style={tdRight}>{op.roomTypesCount ?? 0}</td>
                  <td style={tdRight}>{op.sortOrder}</td>
                  <td style={tdStyle}>{op.notifyEmails || '—'}</td>
                  <td style={tdStyle}>
                    <span style={badge(op.active ? 'success' : 'neutral')}>{op.active ? 'Активен' : 'Выключен'}</span>
                  </td>
                  <td style={tdRight}>
                    <div style={{ display: 'inline-flex', gap: 8 }}>
                      <button type="button" style={button('secondary', 'sm')} onClick={() => router.push(`/operators/${op.id}`)}>
                        Изменить
                      </button>
                      <button
                        type="button"
                        style={button('tertiary', 'sm')}
                        disabled={busy}
                        onClick={() => {
                          setError(null);
                          setNotice(null);
                          setDupName(`${op.name} (копия)`);
                          setDupCopyEmails(true);
                          setDuplicating(op);
                        }}
                      >
                        Дублировать
                      </button>
                      <button type="button" style={button('tertiary', 'sm')} disabled={busy} onClick={() => onToggle(op)}>
                        {op.active ? 'Выкл' : 'Вкл'}
                      </button>
                      <button
                        type="button"
                        style={button('danger', 'sm')}
                        disabled={busy || (op.roomTypesCount ?? 0) > 0}
                        title={(op.roomTypesCount ?? 0) > 0 ? 'За оператором закреплены Room Type — сначала переведите их на другого' : undefined}
                        onClick={() => {
                          setError(null);
                          setNotice(null);
                          setRemoving(op);
                        }}
                      >
                        Удалить
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableWrap>
      )}

      {creating ? (
        <Modal title="Новый оператор" onClose={() => setCreating(null)} width={560}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ ...text.caption }}>Название видно на витрине в строке предложения и в фильтре «Туроператор».</div>
            <OperatorForm value={creating} onChange={setCreating} disabled={busy} />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button type="button" style={button('tertiary', 'md')} disabled={busy} onClick={() => setCreating(null)}>
                Отмена
              </button>
              <button type="button" style={button('primary', 'md')} disabled={busy} onClick={onCreate}>
                Создать оператора
              </button>
            </div>
          </div>
        </Modal>
      ) : null}

      {duplicating ? (
        <Modal title="Дублировать оператора" onClose={() => setDuplicating(null)} width={560}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ ...text.caption }}>
              Копия получит новый operator_id. Остальные настройки копируются — их можно изменить после создания.
            </div>
            <div style={{ padding: '12px 14px', borderRadius: 12, background: t.surfaceHover, fontSize: 13 }}>
              Источник: <strong>{duplicating.name}</strong> · operator_id {duplicating.operatorId}
            </div>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, color: t.textSecondary }}>
              Название копии
              <input style={compactInput} value={dupName} onChange={(e) => setDupName(e.target.value)} maxLength={128} disabled={busy} />
            </label>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 14, color: t.textPrimary, cursor: 'pointer' }}>
              <input type="checkbox" checked={dupCopyEmails} onChange={(e) => setDupCopyEmails(e.target.checked)} disabled={busy} />
              Скопировать настройки почты бронирований
            </label>
            <div style={{ padding: '12px 14px', borderRadius: 12, background: t.accentSoft, color: t.textSecondary, fontSize: 12, lineHeight: 1.5 }}>
              Room Type исходного оператора не копируются — копия создаётся пустой и выключенной.
              Назначить ей номера можно в разделе «Отели и номера».
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button type="button" style={button('tertiary', 'md')} disabled={busy} onClick={() => setDuplicating(null)}>
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
          message={<>Оператор «{removing.name}» будет удалён. Room Type за ним не закреплены, поэтому витрина не изменится.</>}
          busy={busy}
          onConfirm={onRemove}
          onClose={() => setRemoving(null)}
        />
      ) : null}
    </div>
  );
}
