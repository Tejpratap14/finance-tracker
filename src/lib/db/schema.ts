import { relations } from 'drizzle-orm';
import {
  pgTable,
  pgEnum,
  uuid,
  text,
  bigint,
  boolean,
  integer,
  timestamp,
  date,
  jsonb,
  unique,
} from 'drizzle-orm/pg-core';

/**
 * MONEY RULE: every money column is `bigint` storing MINOR UNITS (paise).
 * ₹1,250.75  ->  125075. Never store rupees as float.
 * We use mode: 'number' for ergonomics — JS Number is safe up to 2^53 paise
 * (≈ ₹90 trillion), far beyond any freelancer's figures.
 *
 * COMPUTED RULE: "spent", "tax owed", "budget remaining" are NEVER stored.
 * They are always derived server-side from `transactions`. The only exception
 * is `tax_estimates`, which is an explicit point-in-time *snapshot* we keep on
 * purpose (so we can show "your estimate as of last quarter").
 */

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export const txDirectionEnum = pgEnum('tx_direction', ['debit', 'credit']); // debit = money out, credit = money in
export const txSourceEnum = pgEnum('tx_source', ['manual', 'import', 'aa']);
export const classificationEnum = pgEnum('classification', ['business', 'personal', 'unknown']);
export const categoryTypeEnum = pgEnum('category_type', ['income', 'expense']);
export const invoiceStatusEnum = pgEnum('invoice_status', ['draft', 'sent', 'paid', 'overdue', 'cancelled']);
export const budgetPeriodEnum = pgEnum('budget_period', ['monthly', 'yearly']);
export const taxSchemeEnum = pgEnum('tax_scheme', ['44ADA', 'actual']);
export const taxRegimeEnum = pgEnum('tax_regime', ['new', 'old']);
export const taxQuarterEnum = pgEnum('tax_quarter', ['Q1', 'Q2', 'Q3', 'Q4']); // advance-tax instalments
export const subPlanEnum = pgEnum('sub_plan', ['free', 'pro']);
export const subStatusEnum = pgEnum('sub_status', ['trialing', 'active', 'past_due', 'cancelled']);

// ---------------------------------------------------------------------------
// Auth: users + refresh tokens
// ---------------------------------------------------------------------------

export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  email: text('email').notNull().unique(),
  name: text('name'),
  passwordHash: text('password_hash').notNull(), // argon2 hash
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull().$onUpdate(() => new Date()),
});

// Refresh tokens are hashed (never stored raw) and rotated on each use.
export const refreshTokens = pgTable('refresh_tokens', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  tokenHash: text('token_hash').notNull(), // sha-256 of the raw refresh token
  expiresAt: timestamp('expires_at').notNull(),
  revokedAt: timestamp('revoked_at'), // set when rotated or logged out
  replacedById: uuid('replaced_by_id'), // points at the token that superseded this one
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------

export const categories = pgTable(
  'categories',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
    name: text('name').notNull(),
    type: categoryTypeEnum('type').notNull().default('expense'),
    icon: text('icon'),
    color: text('color'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => [unique('categories_user_name_unique').on(t.userId, t.name)],
);

// ---------------------------------------------------------------------------
// Invoices (client billing) — reconciliation feature builds on this later
// ---------------------------------------------------------------------------

export const invoices = pgTable('invoices', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  clientName: text('client_name').notNull(),
  clientGstin: text('client_gstin'),
  amount: bigint('amount', { mode: 'number' }).notNull(), // paise
  currency: text('currency').notNull().default('INR'),
  issuedAt: date('issued_at').notNull(),
  dueAt: date('due_at'),
  status: invoiceStatusEnum('status').notNull().default('sent'),
  paidAt: timestamp('paid_at'),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull().$onUpdate(() => new Date()),
});

// ---------------------------------------------------------------------------
// Transactions — the single source of truth for all money movement.
// Income = direction 'credit'; expense = direction 'debit'. (We reuse this
// table for income_events rather than a separate table.)
// ---------------------------------------------------------------------------

export const transactions = pgTable('transactions', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  categoryId: uuid('category_id').references(() => categories.id, { onDelete: 'set null' }),
  invoiceId: uuid('invoice_id').references(() => invoices.id, { onDelete: 'set null' }), // link a credit to the invoice it paid

  direction: txDirectionEnum('direction').notNull(),
  amount: bigint('amount', { mode: 'number' }).notNull(), // paise, always positive
  currency: text('currency').notNull().default('INR'),
  description: text('description'),
  merchant: text('merchant'),
  occurredAt: timestamp('occurred_at').notNull(),
  source: txSourceEnum('source').notNull().default('manual'),

  // --- Freelancer / tax fields ---
  classification: classificationEnum('classification').notNull().default('unknown'),
  isDeductible: boolean('is_deductible').notNull().default(false),
  deductionCategory: text('deduction_category'),
  confidence: integer('confidence'), // 0-100, AI's confidence in its suggested split (null = human-entered)
  isConfirmed: boolean('is_confirmed').notNull().default(false), // user reviewed the AI suggestion — never auto-final on money

  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull().$onUpdate(() => new Date()),
});

// ---------------------------------------------------------------------------
// Budgets — limit only; "spent" is computed from transactions, never stored.
// ---------------------------------------------------------------------------

export const budgets = pgTable('budgets', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  categoryId: uuid('category_id').references(() => categories.id, { onDelete: 'cascade' }), // null = overall budget
  amount: bigint('amount', { mode: 'number' }).notNull(), // paise limit
  period: budgetPeriodEnum('period').notNull().default('monthly'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull().$onUpdate(() => new Date()),
});

// ---------------------------------------------------------------------------
// Alerts: rules (config) + events (fired instances)
// ---------------------------------------------------------------------------

export const alertRules = pgTable('alert_rules', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  type: text('type').notNull(), // e.g. 'budget_exceeded', 'tax_due', 'low_balance'
  config: jsonb('config'), // rule-specific thresholds/params
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const alertEvents = pgTable('alert_events', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  ruleId: uuid('rule_id').references(() => alertRules.id, { onDelete: 'set null' }),
  type: text('type').notNull(),
  message: text('message').notNull(),
  payload: jsonb('payload'),
  readAt: timestamp('read_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ---------------------------------------------------------------------------
// Subscriptions (Razorpay later). Server-side entitlement = source of truth.
// ---------------------------------------------------------------------------

export const subscriptions = pgTable('subscriptions', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull().unique(),
  plan: subPlanEnum('plan').notNull().default('free'),
  status: subStatusEnum('status').notNull().default('active'),
  razorpaySubscriptionId: text('razorpay_subscription_id'),
  currentPeriodEnd: timestamp('current_period_end'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull().$onUpdate(() => new Date()),
});

// ---------------------------------------------------------------------------
// Tax profile — one row per (user, financial year). Drives the set-aside math.
// ---------------------------------------------------------------------------

export const taxProfiles = pgTable(
  'tax_profiles',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
    financialYear: text('financial_year').notNull(), // e.g. '2026-27'
    scheme: taxSchemeEnum('scheme').notNull().default('44ADA'),
    regime: taxRegimeEnum('regime').notNull().default('new'),
    pan: text('pan'),
    panVerified: boolean('pan_verified').notNull().default(false),
    estimatedGrossReceipts: bigint('estimated_gross_receipts', { mode: 'number' }), // paise, optional user hint
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull().$onUpdate(() => new Date()),
  },
  (t) => [unique('tax_profiles_user_fy_unique').on(t.userId, t.financialYear)],
);

// ---------------------------------------------------------------------------
// Tax estimates — computed snapshots per advance-tax quarter (kept on purpose).
// ---------------------------------------------------------------------------

export const taxEstimates = pgTable('tax_estimates', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  financialYear: text('financial_year').notNull(),
  quarter: taxQuarterEnum('quarter').notNull(),
  estimatedIncome: bigint('estimated_income', { mode: 'number' }).notNull(), // paise
  estimatedDeductions: bigint('estimated_deductions', { mode: 'number' }).notNull(),
  taxableIncome: bigint('taxable_income', { mode: 'number' }).notNull(),
  estimatedTax: bigint('estimated_tax', { mode: 'number' }).notNull(),
  advanceTaxDue: bigint('advance_tax_due', { mode: 'number' }).notNull(), // this instalment's amount
  cumulativePercent: integer('cumulative_percent').notNull(), // 15 / 45 / 75 / 100
  dueDate: date('due_date').notNull(),
  computedAt: timestamp('computed_at').defaultNow().notNull(),
});

// ---------------------------------------------------------------------------
// Relations
// ---------------------------------------------------------------------------

export const usersRelations = relations(users, ({ many, one }) => ({
  transactions: many(transactions),
  categories: many(categories),
  invoices: many(invoices),
  budgets: many(budgets),
  refreshTokens: many(refreshTokens),
  taxProfiles: many(taxProfiles),
  subscription: one(subscriptions),
}));

export const transactionsRelations = relations(transactions, ({ one }) => ({
  user: one(users, { fields: [transactions.userId], references: [users.id] }),
  category: one(categories, { fields: [transactions.categoryId], references: [categories.id] }),
  invoice: one(invoices, { fields: [transactions.invoiceId], references: [invoices.id] }),
}));

export const categoriesRelations = relations(categories, ({ one, many }) => ({
  user: one(users, { fields: [categories.userId], references: [users.id] }),
  transactions: many(transactions),
}));

export const invoicesRelations = relations(invoices, ({ one, many }) => ({
  user: one(users, { fields: [invoices.userId], references: [users.id] }),
  payments: many(transactions),
}));

export const budgetsRelations = relations(budgets, ({ one }) => ({
  user: one(users, { fields: [budgets.userId], references: [users.id] }),
  category: one(categories, { fields: [budgets.categoryId], references: [categories.id] }),
}));

export const refreshTokensRelations = relations(refreshTokens, ({ one }) => ({
  user: one(users, { fields: [refreshTokens.userId], references: [users.id] }),
}));

export const taxProfilesRelations = relations(taxProfiles, ({ one }) => ({
  user: one(users, { fields: [taxProfiles.userId], references: [users.id] }),
}));

export const subscriptionsRelations = relations(subscriptions, ({ one }) => ({
  user: one(users, { fields: [subscriptions.userId], references: [users.id] }),
}));
