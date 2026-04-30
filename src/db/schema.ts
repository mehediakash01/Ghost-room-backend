import { pgTable, varchar, text, timestamp } from 'drizzle-orm/pg-core';
import { randomUUID } from 'crypto';

const generateId = (prefix: string) => `${prefix}_${randomUUID().replace(/-/g, '').substring(0, 10)}`;

export const users = pgTable('users', {
  id: varchar('id', { length: 255 }).$defaultFn(() => generateId('usr')).primaryKey(),
  username: varchar('username', { length: 255 }).notNull().unique(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const rooms = pgTable('rooms', {
  id: varchar('id', { length: 255 }).$defaultFn(() => generateId('room')).primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  createdBy: varchar('created_by', { length: 255 }).references(() => users.username).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const messages = pgTable('messages', {
  id: varchar('id', { length: 255 }).$defaultFn(() => generateId('msg')).primaryKey(),
  roomId: varchar('room_id', { length: 255 }).references(() => rooms.id).notNull(),
  username: varchar('username', { length: 255 }).references(() => users.username).notNull(),
  content: text('content').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
