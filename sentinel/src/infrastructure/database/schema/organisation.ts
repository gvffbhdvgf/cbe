import { pgTable, timestamp, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';

export const organisations = pgTable('organisations', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 240 }).notNull(),
  status: varchar('status', { length: 24 }).notNull().default('active'),
  identifierIssuer: varchar('identifier_issuer', { length: 120 }),
  identifierValue: varchar('identifier_value', { length: 180 }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex('organisations_issuer_value_unique').on(table.identifierIssuer, table.identifierValue),
]);
