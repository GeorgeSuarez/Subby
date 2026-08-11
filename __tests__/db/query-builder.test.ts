import { subsWhereClause } from '@/db/query-builder';

describe('subsWhereClause', () => {
  it('filters seeded rows out when includeSeeded is false', () => {
    expect(subsWhereClause(false)).toBe(' WHERE seeded = 0');
  });

  it('emits no clause at all for a full read', () => {
    expect(subsWhereClause(true)).toBe('');
  });

  it('never emits a bare AND — always starts with WHERE', () => {
    expect(subsWhereClause(false)).toMatch(/^ WHERE /);
    expect(subsWhereClause(true)).not.toContain('AND');
  });

  it('combines an existing WHERE fragment with the seeded filter', () => {
    expect(subsWhereClause(false, ' WHERE archived = 0')).toBe(
      ' WHERE archived = 0 AND seeded = 0',
    );
  });

  it('keeps the archived filter when seeded rows are included', () => {
    expect(subsWhereClause(true, ' WHERE archived = 0')).toBe(' WHERE archived = 0');
  });

  it('is case-insensitive about the WHERE keyword', () => {
    expect(subsWhereClause(false, 'where archived = 0')).toBe(
      ' WHERE archived = 0 AND seeded = 0',
    );
  });
});
