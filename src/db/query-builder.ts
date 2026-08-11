/**
 * Pure SQL fragment builders for the subscriptions table (no DB imports).
 *
 * Split out so the seeded-visibility filtering logic is unit-testable in
 * plain Node Jest, mirroring the `seed-data.ts` pattern.
 */

/**
 * Build the WHERE clause for a subscriptions read.
 *
 * `where` is either '' or a full 'WHERE …' fragment (e.g. 'WHERE archived = 0').
 * When `includeSeeded` is false, demo (seeded) rows are excluded — seeded data
 * is only visible to the test account.
 */
export function subsWhereClause(includeSeeded: boolean, where = ''): string {
  const conditions: string[] = [];

  const base = where.replace(/^\s*WHERE\s+/i, '');
  if (base) conditions.push(base);

  if (!includeSeeded) conditions.push('seeded = 0');

  return conditions.length > 0 ? ` WHERE ${conditions.join(' AND ')}` : '';
}
