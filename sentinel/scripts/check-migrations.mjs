import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
const folder = 'src/infrastructure/database/migrations';
const journal = JSON.parse(await readFile(join(folder, 'meta/_journal.json'), 'utf8'));
const files = new Set(await readdir(folder));
const indices = new Set();
const tags = new Set();
for (const entry of journal.entries) {
  if (indices.has(entry.idx) || tags.has(entry.tag)) throw new Error('Duplicate migration journal index or tag');
  indices.add(entry.idx); tags.add(entry.tag);
  if (!files.has(`${entry.tag}.sql`)) throw new Error(`Missing migration file: ${entry.tag}.sql`);
  const source = await readFile(join(folder, `${entry.tag}.sql`), 'utf8');
  if (!source.trim()) throw new Error(`Empty migration: ${entry.tag}`);
}
for (const file of files) if (/^\d+_.+\.sql$/.test(file) && !tags.has(file.replace(/\.sql$/, ''))) throw new Error(`Migration ${file} is not registered in _journal.json`);
console.log(`Migration journal valid: ${journal.entries.length} migrations.`);
