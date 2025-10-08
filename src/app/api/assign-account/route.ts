import { NextRequest, NextResponse } from 'next/server';
import { assignAccountToTransaction } from '@/lib/database';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { transactionId, assignedAccountCode, isDebitAccount } = body;

    console.log('API received:', { transactionId, assignedAccountCode, isDebitAccount, body });
    console.log('Types:', {
      transactionIdType: typeof transactionId,
      assignedAccountCodeType: typeof assignedAccountCode,
      isDebitAccountType: typeof isDebitAccount
    });

    // Validate required fields
    if (!transactionId || !assignedAccountCode || typeof isDebitAccount !== 'boolean') {
      console.log('Validation failed:', {
        hasTransactionId: !!transactionId,
        transactionIdValue: transactionId,
        hasAssignedAccountCode: !!assignedAccountCode,
        assignedAccountCodeValue: assignedAccountCode,
        isDebitAccountType: typeof isDebitAccount,
        isDebitAccountValue: isDebitAccount
      });
      return NextResponse.json({
        error: 'Transaction ID, assigned account code, and account type (debit/credit) are required'
      }, { status: 400 });
    }

    // Validate transaction ID is a number
    const txnId = parseInt(transactionId);
    if (isNaN(txnId)) {
      return NextResponse.json({ error: 'Invalid transaction ID' }, { status: 400 });
    }

    const result = await assignAccountToTransaction(txnId, assignedAccountCode, isDebitAccount);

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: `Account ${assignedAccountCode} assigned successfully`
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