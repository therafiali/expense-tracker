import { format } from 'date-fns';

/** One day of fuel, buffer already included. */
export const DAILY_FUEL_COST = 500;

/** One reminder shared by phone and web. A new petrol expense updates this date. */
export const PETROL_REFUEL_REMINDER_ID = 'petrol-refuel';
export const PETROL_REFUEL_TIME = '09:00';

export function isPetrolCategory(category?: string | null) {
  return category?.trim().toLowerCase() === 'petrol';
}

function usableAmount(amount?: number) {
  if (typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0) return null;
  return amount;
}

function formatFuelDays(days: number) {
  if (days < 0.05) return 'less than a day';
  const rounded = Math.round(days * 10) / 10;
  const text = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
  return `${text} ${rounded === 1 ? 'day' : 'days'}`;
}

export function formatPetrolDays(amount?: number) {
  const value = usableAmount(amount);
  if (value == null) {
    return `${DAILY_FUEL_COST} covers about 1 day. Enter the amount to see the next refuel date.`;
  }
  return `About ${formatFuelDays(value / DAILY_FUEL_COST)}.`;
}

/** Next refuel moment from the expense date. Null until the amount is entered. */
export function suggestedRefuelDate(amount: number | undefined, from: Date) {
  const value = usableAmount(amount);
  if (value == null) return null;
  return new Date(from.getTime() + (value / DAILY_FUEL_COST) * 86_400_000);
}

export function toDateKey(date: Date) {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

export function dateFromKey(dateKey: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return null;
  const [year, month, day] = dateKey.split('-').map(Number);
  const date = new Date(year, (month ?? 1) - 1, day ?? 1);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatDateKey(dateKey: string) {
  const date = dateFromKey(dateKey);
  return date ? format(date, 'EEE, d MMM yyyy') : dateKey;
}

/** 9:00 on the chosen calendar day, stored as the reminder time. */
export function fireAtFromDateKey(dateKey: string, time = PETROL_REFUEL_TIME) {
  const date = dateFromKey(dateKey);
  if (!date) return null;
  const [hourPart, minutePart] = time.split(':');
  const hour = Number(hourPart);
  const minute = Number(minutePart);
  date.setHours(Number.isFinite(hour) ? hour : 9, Number.isFinite(minute) ? minute : 0, 0, 0);
  return date.toISOString();
}
