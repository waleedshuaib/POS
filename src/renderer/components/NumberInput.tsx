import { ChangeEvent, FocusEvent, useEffect, useState } from 'react';

export interface NumberInputProps {
  value: number | null | undefined;
  onChange: (n: number | null) => void;
  className?: string;
  placeholder?: string;
  disabled?: boolean;
  min?: number;
  max?: number;
  /** Decimal places to keep on blur. Default: 2 (money). Use 0 for integers. */
  decimals?: number;
  /** Suffix shown inside the input (e.g. "₪", "%", "kg"). */
  suffix?: string;
  /** True (default) shows empty when value is null/undefined; numbers always render. */
  emptyWhenNull?: boolean;
  autoFocus?: boolean;
  dir?: 'rtl' | 'ltr';
  id?: string;
}

/**
 * Number-only input that:
 *   - shows EMPTY when value is null/undefined (default), not "0"
 *   - rounds the parsed value to `decimals` (default 2) on blur, so the user
 *     can never end up with 100.234 stored
 *   - exposes the rounded number via onChange (`null` if cleared)
 *
 * Use for prices, costs, quantities — anywhere "0 prefilled" was confusing.
 */
export function NumberInput({
  value,
  onChange,
  className = 'input',
  placeholder = '',
  disabled,
  min,
  max,
  decimals = 2,
  suffix,
  emptyWhenNull = true,
  autoFocus,
  dir,
  id,
}: NumberInputProps) {
  // Local string state so the user can type "100." without us collapsing it to "100".
  const [text, setText] = useState<string>(() => formatInitial(value, emptyWhenNull));

  // Keep local in sync if the parent resets the value (e.g. modal opening with new editing).
  useEffect(() => {
    setText(formatInitial(value, emptyWhenNull));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value;
    setText(raw);
    if (raw.trim() === '') {
      onChange(null);
      return;
    }
    const parsed = parseFloat(raw);
    if (isNaN(parsed)) return;
    onChange(parsed);
  }

  function handleBlur(_e: FocusEvent<HTMLInputElement>) {
    if (text.trim() === '') {
      onChange(null);
      return;
    }
    let parsed = parseFloat(text);
    if (isNaN(parsed)) {
      setText('');
      onChange(null);
      return;
    }
    if (min !== undefined && parsed < min) parsed = min;
    if (max !== undefined && parsed > max) parsed = max;
    const factor = Math.pow(10, decimals);
    const rounded = Math.round((parsed + Number.EPSILON) * factor) / factor;
    const display = decimals > 0 ? rounded.toFixed(decimals) : String(Math.round(rounded));
    setText(display);
    onChange(rounded);
  }

  if (suffix) {
    return (
      <div className="relative">
        <input
          id={id}
          type="text"
          inputMode="decimal"
          className={`${className} pe-10`}
          value={text}
          onChange={handleChange}
          onBlur={handleBlur}
          placeholder={placeholder}
          disabled={disabled}
          autoFocus={autoFocus}
          dir={dir}
        />
        <span className="absolute top-1/2 -translate-y-1/2 end-3 text-slate-400 text-xs pointer-events-none">
          {suffix}
        </span>
      </div>
    );
  }
  return (
    <input
      id={id}
      type="text"
      inputMode="decimal"
      className={className}
      value={text}
      onChange={handleChange}
      onBlur={handleBlur}
      placeholder={placeholder}
      disabled={disabled}
      autoFocus={autoFocus}
      dir={dir}
    />
  );
}

/** Convenience: 2-decimal money input with the currency suffix. */
export function MoneyInput(props: Omit<NumberInputProps, 'decimals'>) {
  return <NumberInput {...props} decimals={2} />;
}

/** Convenience: integer input. */
export function IntInput(props: Omit<NumberInputProps, 'decimals'>) {
  return <NumberInput {...props} decimals={0} />;
}

function formatInitial(value: number | null | undefined, _emptyWhenNull: boolean): string {
  if (value === null || value === undefined) return '';
  if (typeof value !== 'number' || isNaN(value)) return '';
  return value.toString();
}
