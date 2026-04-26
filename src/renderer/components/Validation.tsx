import { ReactNode } from 'react';
import { AlertTriangle, AlertCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';

/**
 * Inline field-level error shown below an input.
 * Renders nothing if `error` is empty.
 */
export function FieldError({ error }: { error?: string | null }) {
  if (!error) return null;
  return (
    <div className="text-xs text-red-600 mt-1 flex items-center gap-1">
      <AlertCircle size={12} />
      <span>{error}</span>
    </div>
  );
}

/**
 * Top-of-form summary box for any number of validation messages.
 * Renders nothing if `errors` is empty.
 */
export function ValidationSummary({ errors }: { errors: string[] }) {
  const { t } = useTranslation();
  if (errors.length === 0) return null;
  return (
    <div className="border border-amber-200 bg-amber-50 text-amber-800 rounded-md p-3 text-sm space-y-1 mb-2">
      <div className="flex items-center gap-2 font-semibold">
        <AlertTriangle size={16} />
        {t('common.validationErrors')}
      </div>
      <ul className="list-disc ps-5 space-y-0.5">
        {errors.map((e, i) => (
          <li key={i}>{e}</li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Backend / mutation error banner. Pass the error from `useMutation`.
 */
export function ServerError({ error }: { error: unknown }) {
  if (!error) return null;
  const msg = error instanceof Error ? error.message : String(error);
  return (
    <div className="border border-red-200 bg-red-50 text-red-700 rounded-md p-3 text-sm flex items-start gap-2 mb-2">
      <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
      <span>{msg}</span>
    </div>
  );
}

/**
 * Form group wrapper: renders label + child input + (optional) error message.
 * Adds the red ring on inputs when invalid via the wrapping CSS class.
 */
export function Field({
  label,
  error,
  required,
  children,
  hint,
}: {
  label: string;
  error?: string | null;
  required?: boolean;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <div>
      <label className="label">
        {label}
        {required && <span className="text-red-500 ms-1">*</span>}
      </label>
      <div className={error ? 'field-invalid' : ''}>{children}</div>
      {hint && !error && <div className="text-xs text-slate-500 mt-1">{hint}</div>}
      <FieldError error={error} />
    </div>
  );
}
