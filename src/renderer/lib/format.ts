import { format } from 'date-fns';
import { ar, enUS } from 'date-fns/locale';

export function currency(amount: number, symbol = '₪'): string {
  return `${amount.toFixed(2)} ${symbol}`;
}

export function dateTime(d: Date | string | number, lang: 'ar' | 'en' = 'ar'): string {
  const date = d instanceof Date ? d : new Date(d);
  return format(date, 'yyyy-MM-dd HH:mm', { locale: lang === 'ar' ? ar : enUS });
}

export function dateOnly(d: Date | string | number, lang: 'ar' | 'en' = 'ar'): string {
  const date = d instanceof Date ? d : new Date(d);
  return format(date, 'yyyy-MM-dd', { locale: lang === 'ar' ? ar : enUS });
}

export function clsx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}
