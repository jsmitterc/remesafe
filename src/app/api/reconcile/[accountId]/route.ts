import { NextRequest, NextResponse } from 'next/server';
import { createReconciliationTransaction, getAccountBalance } from '@/lib/database';

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
    const { bankBalance, reconciliationDate, description } = body;

    // Validate required fields
    if (typeof bankBalance !== 'number') {
      return NextResponse.json({ error: 'Bank balance is required and must be a number' }, { status: 400 });
    }

    if (!reconciliationDate) {
      return NextResponse.json({ error: 'Reconciliation date is required' }, { status: 400 });
    }

    // Validate date format
    const date = new Date(reconciliationDate);
    if (isNaN(date.getTime())) {
      return NextResponse.json({ error: 'Invalid date format' }, { status: 400 });
    }

    // Create reconciliation transaction
    const result = await createReconciliationTransaction(accountId, {
      bankBalance,
      reconciliationDate: reconciliationDate,
      description
    });

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: 'Account reconciled successfully',
        transaction: result.transaction
      });
    } else {
      return NextResponse.json(
        { error: result.error || 'Failed to reconcile account' },
        { status: 400 }
      );
    }

  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json(
      { error: 'Failed to process reconciliation' },
      { status: 500 }
    );
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ accountId: string }> }
) {
  try {
    const { accountId: accountIdParam } = await params;
    const accountId = parseInt(accountIdParam);

    if (!accountId || isNaN(accountId)) {
      return NextResponse.json({ error: 'Valid account ID is required' }, { status: 400 });
    }

    const balance = await getAccountBalance(accountId);

    if (!balance) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 });
    }

    return NextResponse.json(balance);

  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch account balance' },
      { status: 500 }
    );
  }
}