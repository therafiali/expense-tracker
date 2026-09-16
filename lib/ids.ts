import type { Transaction } from './types';

export function generateTransactionId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/** Postgres `uuid` columns reject short/legacy local ids like "4hv2n". */
export function isValidUuid(id: string | undefined | null): boolean {
  if (!id) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    id,
  );
}

/** Assign a real UUID when missing or not Postgres-compatible. */
export function ensureValidTransactionId(tx: Transaction): Transaction {
  if (isValidUuid(tx.id)) return tx;
  return { ...tx, id: generateTransactionId() };
}
