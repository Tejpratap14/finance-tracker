import { relations } from 'drizzle-orm';
import { pgTable as pgTableFn, uuid, text, numeric, timestamp } from 'drizzle-orm/pg-core';


export const organizations = pgTableFn('organizations', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  gstin: text('gstin'), // Business GSTIN
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const users = pgTableFn('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  role: text('role').$type<'admin' | 'manager' | 'employee'>().default('employee').notNull(),
  organizationId: uuid('organization_id').references(() => organizations.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const projects = pgTableFn('projects', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  budget: numeric('budget', { precision: 12, scale: 2 }).notNull(),
  spent: numeric('spent', { precision: 12, scale: 2 }).default('0').notNull(),
  organizationId: uuid('organization_id').references(() => organizations.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const expenses = pgTableFn('expenses', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }).notNull(),
  projectId: uuid('project_id').references(() => projects.id, { onDelete: 'cascade' }),
  merchantName: text('merchant_name').notNull(),
  date: text('date').notNull(), // Format: YYYY-MM-DD
  amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
  category: text('category').notNull(),
  gstRate: numeric('gst_rate', { precision: 5, scale: 2 }).default('0'), // e.g. 18.00
  cgst: numeric('cgst', { precision: 10, scale: 2 }).default('0'),
  sgst: numeric('sgst', { precision: 10, scale: 2 }).default('0'),
  igst: numeric('igst', { precision: 10, scale: 2 }).default('0'),
  merchantGstin: text('merchant_gstin'),
  receiptUrl: text('receipt_url'),
  status: text('status').$type<'pending' | 'approved' | 'rejected'>().default('pending').notNull(),
  notes: text('notes'),
  reviewerId: uuid('reviewer_id').references(() => users.id, { onDelete: 'set null' }),
  rejectionReason: text('rejection_reason'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Relationships
export const organizationsRelations = relations(organizations, ({ many }) => ({
  users: many(users),
  projects: many(projects),
}));

export const usersRelations = relations(users, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [users.organizationId],
    references: [organizations.id],
  }),
  submittedExpenses: many(expenses, { relationName: 'submittedExpenses' }),
  reviewedExpenses: many(expenses, { relationName: 'reviewedExpenses' }),
}));

export const projectsRelations = relations(projects, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [projects.organizationId],
    references: [organizations.id],
  }),
  expenses: many(expenses),
}));

export const expensesRelations = relations(expenses, ({ one }) => ({
  user: one(users, {
    fields: [expenses.userId],
    references: [users.id],
    relationName: 'submittedExpenses',
  }),
  project: one(projects, {
    fields: [expenses.projectId],
    references: [projects.id],
  }),
  reviewer: one(users, {
    fields: [expenses.reviewerId],
    references: [users.id],
    relationName: 'reviewedExpenses',
  }),
}));
