import { NextResponse } from 'next/server';
import { getExpenses } from '@/db/dbHelper';

export async function GET() {
  try {
    const expensesList = await getExpenses();
    const approvedExpenses = expensesList.filter((e: any) => e.status === 'approved');

    // CSV Header row
    const headers = [
      'Date',
      'Voucher Type',
      'Expense Ledger (Debit)',
      'Expense Amount',
      'CGST Input Ledger (Debit)',
      'CGST Amount',
      'SGST Input Ledger (Debit)',
      'SGST Amount',
      'IGST Input Ledger (Debit)',
      'IGST Amount',
      'Credit Ledger (Reimbursement)',
      'Credit Amount (Total)',
      'Narration'
    ];

    const csvRows = [headers.join(',')];

    for (const exp of approvedExpenses) {
      // Map category to a standard Tally ledger name
      let ledgerName = 'Office Expenses';
      if (exp.category === 'Food/Beverages') ledgerName = 'Staff Welfare Expenses';
      else if (exp.category === 'Travel') ledgerName = 'Travelling & Conveyance';
      else if (exp.category === 'Fuel') ledgerName = 'Fuel & Conveyance Expenses';
      else if (exp.category === 'Software/SaaS') ledgerName = 'Software Subscription Charges';
      else if (exp.category === 'Supplies') ledgerName = 'Printing & Stationery';
      else if (exp.category === 'Services') ledgerName = 'Professional Fees';

      // Base Amount = Total Amount - CGST - SGST - IGST
      const totalAmount = parseFloat(exp.amount) || 0;
      const cgst = parseFloat(exp.cgst) || 0;
      const sgst = parseFloat(exp.sgst) || 0;
      const igst = parseFloat(exp.igst) || 0;
      const baseAmount = (totalAmount - cgst - sgst - igst).toFixed(2);

      // Narration details
      const narrationText = `Claim Approved: ${exp.merchantName} - ${exp.notes || 'No description'}. GSTIN: ${exp.merchantGstin || 'None'}. ID: ${exp.id}`;
      
      // Escape strings containing commas for CSV safety
      const escapedMerchant = exp.merchantName.replace(/"/g, '""');
      const escapedNarration = narrationText.replace(/"/g, '""');

      const row = [
        exp.date,
        'Journal', // Voucher Type
        `"${ledgerName}"`,
        baseAmount,
        '"CGST Input Tax"',
        cgst > 0 ? cgst.toFixed(2) : '0.00',
        '"SGST Input Tax"',
        sgst > 0 ? sgst.toFixed(2) : '0.00',
        '"IGST Input Tax"',
        igst > 0 ? igst.toFixed(2) : '0.00',
        '"Employee Reimbursements Payable"',
        totalAmount.toFixed(2),
        `"${escapedNarration}"`
      ];

      csvRows.push(row.join(','));
    }

    const csvContent = csvRows.join('\n');

    // Return the response as a file download attachment
    return new Response(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="tally_expenses_export.csv"',
        'Cache-Control': 'no-cache',
      },
    });

  } catch (error: any) {
    console.error('Error exporting Tally CSV:', error);
    return NextResponse.json({ error: error.message || 'Failed to export CSV' }, { status: 500 });
  }
}
