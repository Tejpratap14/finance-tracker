import fs from 'fs';
import path from 'path';
import { db } from './index';
import { expenses, projects, users, organizations } from './schema';
import { eq, sql } from 'drizzle-orm';

const MOCK_DB_PATH = path.join(process.cwd(), 'src/db/mockdb.json');

// Helper to read local mock DB file
function readMockDb() {
  try {
    const fileContent = fs.readFileSync(MOCK_DB_PATH, 'utf-8');
    return JSON.parse(fileContent);
  } catch (err) {
    console.error('Error reading mock DB file, returning empty structure:', err);
    return { organizations: [], users: [], projects: [], expenses: [] };
  }
}

// Helper to write local mock DB file
function writeMockDb(data: any) {
  try {
    fs.writeFileSync(MOCK_DB_PATH, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error writing mock DB file:', err);
  }
}

export async function getOrganizations() {
  if (process.env.DATABASE_URL) {
    return await db.select().from(organizations);
  } else {
    return readMockDb().organizations;
  }
}

export async function getUsers() {
  if (process.env.DATABASE_URL) {
    return await db.select().from(users);
  } else {
    return readMockDb().users;
  }
}

export async function getProjects() {
  if (process.env.DATABASE_URL) {
    return await db.select().from(projects);
  } else {
    return readMockDb().projects;
  }
}

export async function getExpenses() {
  if (process.env.DATABASE_URL) {
    return await db.select().from(expenses);
  } else {
    return readMockDb().expenses;
  }
}

export async function createExpense(data: {
  userId: string;
  projectId: string;
  merchantName: string;
  date: string;
  amount: string;
  category: string;
  gstRate: string;
  cgst: string;
  sgst: string;
  igst: string;
  merchantGstin: string | null;
  receiptUrl: string | null;
  notes: string | null;
}) {
  if (process.env.DATABASE_URL) {
    const [newExpense] = await db.insert(expenses).values({
      userId: data.userId,
      projectId: data.projectId,
      merchantName: data.merchantName,
      date: data.date,
      amount: data.amount,
      category: data.category,
      gstRate: data.gstRate,
      cgst: data.cgst,
      sgst: data.sgst,
      igst: data.igst,
      merchantGstin: data.merchantGstin,
      receiptUrl: data.receiptUrl,
      notes: data.notes,
      status: 'pending',
    }).returning();
    return newExpense;
  } else {
    const mockData = readMockDb();
    const newExpense = {
      id: `exp-${Date.now()}`,
      userId: data.userId,
      projectId: data.projectId,
      merchantName: data.merchantName,
      date: data.date,
      amount: data.amount,
      category: data.category,
      gstRate: data.gstRate,
      cgst: data.cgst,
      sgst: data.sgst,
      igst: data.igst,
      merchantGstin: data.merchantGstin,
      receiptUrl: data.receiptUrl,
      status: 'pending' as const,
      notes: data.notes,
      reviewerId: null,
      rejectionReason: null,
      createdAt: new Date().toISOString(),
    };
    mockData.expenses.push(newExpense);
    writeMockDb(mockData);
    return newExpense;
  }
}

export async function updateExpenseStatus(
  id: string,
  status: 'approved' | 'rejected',
  reviewerId: string,
  rejectionReason: string | null = null
) {
  if (process.env.DATABASE_URL) {
    const [updated] = await db.update(expenses)
      .set({
        status,
        reviewerId,
        rejectionReason,
      })
      .where(eq(expenses.id, id))
      .returning();

    // If approved, update the project spent budget
    if (status === 'approved' && updated && updated.projectId) {
      await db.update(projects)
        .set({
          spent: sql`${projects.spent} + ${updated.amount}`
        })
        .where(eq(projects.id, updated.projectId));
    }
    return updated;
  } else {
    const mockData = readMockDb();
    const expenseIndex = mockData.expenses.findIndex((e: any) => e.id === id);
    if (expenseIndex === -1) return null;

    const expense = mockData.expenses[expenseIndex];
    const oldStatus = expense.status;
    expense.status = status;
    expense.reviewerId = reviewerId;
    expense.rejectionReason = rejectionReason;

    // Update project budget if approved and status changed to approved
    if (status === 'approved' && oldStatus !== 'approved' && expense.projectId) {
      const projectIndex = mockData.projects.findIndex((p: any) => p.id === expense.projectId);
      if (projectIndex !== -1) {
        const project = mockData.projects[projectIndex];
        const newSpent = parseFloat(project.spent) + parseFloat(expense.amount);
        project.spent = newSpent.toFixed(2);
      }
    }

    writeMockDb(mockData);
    return expense;
  }
}

export async function seedInitialDataIfDbEmpty() {
  if (!process.env.DATABASE_URL) return;

  try {
    const existingUsers = await db.select().from(users).limit(1);
    if (existingUsers.length > 0) return; // DB already seeded

    console.log('Seeding Supabase Postgres database with initial entities...');
    const localData = readMockDb();

    for (const org of localData.organizations) {
      await db.insert(organizations).values({
        id: org.id,
        name: org.name,
        gstin: org.gstin,
        createdAt: new Date(org.createdAt),
      });
    }

    for (const user of localData.users) {
      await db.insert(users).values({
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        organizationId: user.organizationId,
        createdAt: new Date(user.createdAt),
      });
    }

    for (const proj of localData.projects) {
      await db.insert(projects).values({
        id: proj.id,
        name: proj.name,
        budget: proj.budget,
        spent: proj.spent,
        organizationId: proj.organizationId,
        createdAt: new Date(proj.createdAt),
      });
    }

    for (const exp of localData.expenses) {
      await db.insert(expenses).values({
        id: exp.id,
        userId: exp.userId,
        projectId: exp.projectId,
        merchantName: exp.merchantName,
        date: exp.date,
        amount: exp.amount,
        category: exp.category,
        gstRate: exp.gstRate,
        cgst: exp.cgst,
        sgst: exp.sgst,
        igst: exp.igst,
        merchantGstin: exp.merchantGstin,
        receiptUrl: exp.receiptUrl,
        status: exp.status,
        notes: exp.notes,
        reviewerId: exp.reviewerId,
        rejectionReason: exp.rejectionReason,
        createdAt: new Date(exp.createdAt),
      });
    }

    console.log('Seeding completed successfully.');
  } catch (err) {
    console.error('Failed to seed Supabase database:', err);
  }
}
