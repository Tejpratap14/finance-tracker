import { NextResponse } from 'next/server';
import { getExpenses, getProjects, getUsers, createExpense, updateExpenseStatus, seedInitialDataIfDbEmpty } from '@/db/dbHelper';

// On start, attempt to seed the DB if it is hosted on Supabase and empty
if (process.env.DATABASE_URL) {
  seedInitialDataIfDbEmpty().catch((err) => {
    console.error('Initial DB seeding check failed:', err);
  });
}

export async function GET() {
  try {
    const [expensesList, projectsList, usersList] = await Promise.all([
      getExpenses(),
      getProjects(),
      getUsers(),
    ]);

    return NextResponse.json({
      expenses: expensesList,
      projects: projectsList,
      users: usersList,
    });
  } catch (error: any) {
    console.error('Error fetching expenses dashboard data:', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch data' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const data = await req.json();

    const requiredFields = ['userId', 'projectId', 'merchantName', 'date', 'amount', 'category'];
    for (const field of requiredFields) {
      if (!data[field]) {
        return NextResponse.json({ error: `Missing required field: ${field}` }, { status: 400 });
      }
    }

    const newExpense = await createExpense({
      userId: data.userId,
      projectId: data.projectId,
      merchantName: data.merchantName,
      date: data.date,
      amount: data.amount.toString(),
      category: data.category,
      gstRate: (data.gstRate || 0).toString(),
      cgst: (data.cgst || 0).toString(),
      sgst: (data.sgst || 0).toString(),
      igst: (data.igst || 0).toString(),
      merchantGstin: data.merchantGstin || null,
      receiptUrl: data.receiptUrl || null,
      notes: data.notes || null,
    });

    return NextResponse.json(newExpense, { status: 201 });
  } catch (error: any) {
    console.error('Error creating expense claim:', error);
    return NextResponse.json({ error: error.message || 'Failed to create expense' }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const { id, status, reviewerId, rejectionReason } = await req.json();

    if (!id || !status || !reviewerId) {
      return NextResponse.json({ error: 'Missing id, status, or reviewerId' }, { status: 400 });
    }

    if (status !== 'approved' && status !== 'rejected') {
      return NextResponse.json({ error: 'Status must be approved or rejected' }, { status: 400 });
    }

    const updatedExpense = await updateExpenseStatus(id, status, reviewerId, rejectionReason || null);

    if (!updatedExpense) {
      return NextResponse.json({ error: 'Expense not found' }, { status: 404 });
    }

    return NextResponse.json(updatedExpense);
  } catch (error: any) {
    console.error('Error updating expense status:', error);
    return NextResponse.json({ error: error.message || 'Failed to update status' }, { status: 500 });
  }
}
