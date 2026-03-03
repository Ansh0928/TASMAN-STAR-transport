import { format, parseISO } from 'date-fns';
import { toZonedTime, fromZonedTime } from 'date-fns-tz';
import { TIMEZONE } from '../constants';

export function toAEST(date: Date | string): Date {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return toZonedTime(d, TIMEZONE);
}

export function fromAEST(date: Date): Date {
  return fromZonedTime(date, TIMEZONE);
}

export function formatAEST(date: Date | string, formatStr: string = 'dd/MM/yyyy HH:mm'): string {
  const aestDate = toAEST(date);
  return format(aestDate, formatStr);
}

export function nowAEST(): Date {
  return toZonedTime(new Date(), TIMEZONE);
}
