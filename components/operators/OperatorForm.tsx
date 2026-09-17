'use client';

// Поля оператора: название, operator_id, порядок, активность и почта бронирований.
// Используется и в модалке создания (OperatorsTab), и на странице редактирования (OperatorEditor).
// Валидация — чистая функция validateOperatorState, как в components/rooms/RuleForm.tsx.

import { Field, Toggle, compactInput } from '@/components/notifications/shared';
import { t, text } from '@/lib/theme';
import { OPERATOR_ID_BASE, type Operator, type OperatorBody } from '@/lib/operators-api';

export interface OperatorFormState {
  name: string;
  /** Строкой — поле ввода; пустая строка значит «оставить как есть / выдать автоматически». */
  operatorId: string;
  sortOrder: string;
  active: boolean;
  emailFromName: string;
  notifyEmails: string;
}

export function emptyOperatorState(suggestedOperatorId: number): OperatorFormState {
  return {
    name: '',
    operatorId: String(suggestedOperatorId || OPERATOR_ID_BASE),
    sortOrder: '0',
    active: true,
    emailFromName: '',
    notifyEmails: '',
  };
}

export function stateFromOperator(op: Operator): OperatorFormState {
  return {
    name: op.name,
    operatorId: String(op.operatorId),
    sortOrder: String(op.sortOrder),
    active: op.active,
    emailFromName: op.emailFromName || '',
    notifyEmails: op.notifyEmails || '',
  };
}

/** Русское сообщение или null. Серверные коды дублируют проверки — здесь ловим до запроса. */
export function validateOperatorState(s: OperatorFormState): string | null {
  if (!s.name.trim()) return 'Укажите название оператора';
  if (s.name.trim().length > 128) return 'Название длиннее 128 символов';
  const id = Number(s.operatorId);
  if (!s.operatorId.trim() || !Number.isInteger(id) || id < OPERATOR_ID_BASE) {
    return `ID оператора должен быть целым числом не меньше ${OPERATOR_ID_BASE}`;
  }
  const order = Number(s.sortOrder || '0');
  if (!Number.isInteger(order) || order < 0) return 'Порядок должен быть целым числом от нуля';
  if (s.notifyEmails.trim()) {
    const parts = s.notifyEmails.split(',').map((x) => x.trim()).filter(Boolean);
    if (parts.some((x) => !/^[^\s@,]+@[^\s@,]+\.[^\s@,]+$/.test(x))) {
      return 'Проверьте адреса уведомлений — они должны быть через запятую';
    }
  }
  return null;
}

export function bodyFromState(s: OperatorFormState): OperatorBody {
  return {
    name: s.name.trim(),
    operatorId: Number(s.operatorId),
    sortOrder: Number(s.sortOrder || '0'),
    active: s.active,
    emailFromName: s.emailFromName.trim() || null,
    notifyEmails: s.notifyEmails.trim() || null,
  };
}

export default function OperatorForm({
  value,
  onChange,
  disabled,
  idHint,
}: {
  value: OperatorFormState;
  onChange: (next: OperatorFormState) => void;
  disabled?: boolean;
  /** Подсказка под operator_id — например, сколько Room Type уже используют этот id. */
  idHint?: string;
}) {
  const set = <K extends keyof OperatorFormState>(key: K, v: OperatorFormState[K]) => onChange({ ...value, [key]: v });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Field label="Название на витрине" hint="Так оператор подписан в строке предложения и в фильтре «Туроператор».">
        <input
          style={compactInput}
          value={value.name}
          onChange={(e) => set('name', e.target.value)}
          maxLength={128}
          disabled={disabled}
          placeholder="Arlekino"
        />
      </Field>

      <Field
        label="operator_id"
        hint={idHint || `Свободный id из диапазона ${OPERATOR_ID_BASE} и выше. Должен быть уникальным — у операторов Level.Travel id маленькие, пересечься нельзя.`}
      >
        <input
          style={compactInput}
          value={value.operatorId}
          onChange={(e) => set('operatorId', e.target.value.replace(/[^\d]/g, ''))}
          inputMode="numeric"
          disabled={disabled}
        />
      </Field>

      <Field label="Порядок в списке" hint="Чем меньше число, тем выше оператор в списках админки.">
        <input
          style={compactInput}
          value={value.sortOrder}
          onChange={(e) => set('sortOrder', e.target.value.replace(/[^\d]/g, ''))}
          inputMode="numeric"
          disabled={disabled}
        />
      </Field>

      <Toggle
        checked={value.active}
        onChange={(v) => set('active', v)}
        disabled={disabled}
        label="Активен"
      />
      <div style={{ ...text.caption, marginTop: -10 }}>
        Выключенный оператор не показывается на витрине — его Room Type скрываются из выдачи.
      </div>

      <div style={{ height: 1, background: t.border, margin: '4px 0' }} />

      <div style={{ ...text.sectionTitle }}>Почта бронирований</div>

      <Field label="Имя отправителя писем" hint="Подставляется в письма клиенту и в ваучер.">
        <input
          style={compactInput}
          value={value.emailFromName}
          onChange={(e) => set('emailFromName', e.target.value)}
          maxLength={128}
          disabled={disabled}
          placeholder="Arlekino Tour"
        />
      </Field>

      <Field label="Адреса уведомлений" hint="Кому приходит письмо о новом бронировании. Несколько адресов — через запятую.">
        <input
          style={compactInput}
          value={value.notifyEmails}
          onChange={(e) => set('notifyEmails', e.target.value)}
          maxLength={512}
          disabled={disabled}
          placeholder="booking@arlekino.ru, ops@totus.club"
        />
      </Field>
    </div>
  );
}
