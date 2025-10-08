import { NextRequest, NextResponse } from 'next/server';
import { importBankStatement } from '@/lib/database';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ accountId: string }> }
) {
  try {
    const { accountId: accountIdParam } = await params;
    const accountId = parseInt(accountIdParam);

    if (!accountId || isNaN(accountId)) {
      return NextResponse.json({ error: 'Valid account ID is required' }, { status: 400 });
    }

    const body = await request.json();
    const { statementDate, openingBalance, closingBalance, transactions } = body;

    // Validate required fields
    if (!statementDate || typeof openingBalance !== 'number' || typeof closingBalance !== 'number') {
      return NextResponse.json({
        error: 'Statement date, opening balance, and closing balance are required'
      }, { status: 400 });
    }

    if (!Array.isArray(transactions) || transactions.length === 0) {
      return NextResponse.json({
        error: 'At least one transaction is required'
      }, { status: 400 });
    }

    // Validate date format
    const date = new Date(statementDate);
    if (isNaN(date.getTime())) {
      return NextResponse.json({ error: 'Invalid statement date format' }, { status: 400 });
    }

    // Validate each transaction
    for (let i = 0; i < transactions.length; i++) {
      const txn = transactions[i];
      if (!txn.date || !txn.description || typeof txn.amount !== 'number' || !txn.type) {
        return NextResponse.json({
          error: `Transaction ${i + 1} is missing required fields (date, description, amount, type)`
        }, { status: 400 });
      }

      if (!['debit', 'credit'].includes(txn.type)) {
        return NextResponse.json({
          error: `Transaction ${i + 1} has invalid type. Must be 'debit' or 'credit'`
        }, { status: 400 });
      }

      if (txn.amount <= 0) {
        return NextResponse.json({
          error: `Transaction ${i + 1} amount must be positive`
        }, { status: 400 });
      }

      // Validate transaction date
      const txnDate = new Date(txn.date);
      if (isNaN(txnDate.getTime())) {
        return NextResponse.json({
          error: `Transaction ${i + 1} has invalid date format`
        }, { status: 400 });
      }
    }

    // Import the statement
    const result = await importBankStatement({
      accountId,
      statementDate,
      openingBalance,
      closingBalance,
      transactions
    });

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: `Statement imported successfully with ${transactions.length} transactions`,
        transactions: result.transactions
      });
    } else {
      return NextResponse.json(
        { error: result.error || 'Failed to import statement' },
        { status: 400 }
      );
    }

  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json(
      { error: 'Failed to process statement import' },
      { status: 500 }
    );
  }
}