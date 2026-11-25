import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

const migrationPath = new URL('./migrations/0015_audit_history_immutability.sql', import.meta.url);
const journalPath = new URL('./migrations/meta/_journal.json', import.meta.url);

describe('audit history immutability migration contract', () => {
  it('registers migration 0015 in sequence', async () => {
    const journal = JSON.parse(await readFile(journalPath, 'utf8')) as { entries: Array<{ idx: number; tag: string }> };
    expect(journal.entries).toHaveLength(16);
    expect(journal.entries[15]).toMatchObject({ idx: 15, tag: '0015_audit_history_immutability' });
  });

  it('prevents audit records from being updated or deleted', async () => {
    const sql = await readFile(migrationPath, 'utf8');
    expect(sql).toContain('audit_events_append_only');
    expect(sql).toContain('BEFORE UPDATE OR DELETE ON public.audit_events');
    expect(sql).toContain('Audit history is append-only');
  });
});
