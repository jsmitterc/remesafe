import { NextRequest, NextResponse } from 'next/server';
import { assignAccountToTransaction } from '@/lib/database';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { transactionId, assignedAccountId, isDebitAccount } = body;

    console.log('API received:', { transactionId, assignedAccountId, isDebitAccount, body });
    console.log('Types:', {
      transactionIdType: typeof transactionId,
      assignedAccountIdType: typeof assignedAccountId,
      isDebitAccountType: typeof isDebitAccount
    });

    // Validate required fields
    if (!transactionId || !assignedAccountId || typeof isDebitAccount !== 'boolean') {
      console.log('Validation failed:', {
        hasTransactionId: !!transactionId,
        transactionIdValue: transactionId,
        hasAssignedAccountId: !!assignedAccountId,
        assignedAccountIdValue: assignedAccountId,
        isDebitAccountType: typeof isDebitAccount,
        isDebitAccountValue: isDebitAccount
      });
      return NextResponse.json({
        error: 'Transaction ID, assigned account ID, and account type (debit/credit) are required'
      }, { status: 400 });
    }

    // Validate IDs are numbers
    const txnId = parseInt(transactionId);
    const accId = parseInt(assignedAccountId);
    if (isNaN(txnId) || isNaN(accId)) {
      return NextResponse.json({ error: 'Invalid transaction or account ID' }, { status: 400 });
    }

    const result = await assignAccountToTransaction(txnId, accId, isDebitAccount);

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: `Account assigned successfully`
      });
    } else {
      return NextResponse.json(
        { error: result.error || 'Failed to assign account' },
        { status: 400 }
      );
    }

  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json(
      { error: 'Failed to process account assignment' },
      { status: 500 }
    );
  }
}