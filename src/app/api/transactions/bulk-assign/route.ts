import { NextRequest, NextResponse } from 'next/server';
import { createAuthHandler, AuthenticatedRequest } from '@/lib/auth-middleware';
import { bulkAssignAccountToTransactions } from '@/lib/database';

async function postHandler(request: AuthenticatedRequest): Promise<NextResponse> {
  try {
    const user = request.user!;
    const body = await request.json();

    const { transactionIds, assignedAccountCode, isDebitAccount } = body;

    // Validate required fields
    if (!transactionIds || !Array.isArray(transactionIds) || transactionIds.length === 0) {
      return NextResponse.json(
        { error: 'Transaction IDs array is required' },
        { status: 400 }
      );
    }

    if (!assignedAccountCode) {
      return NextResponse.json(
        { error: 'Assigned account code is required' },
        { status: 400 }
      );
    }

    if (typeof isDebitAccount !== 'boolean') {
      return NextResponse.json(
        { error: 'isDebitAccount must be a boolean' },
        { status: 400 }
      );
    }

    // Assign accounts to transactions
    const result = await bulkAssignAccountToTransactions(transactionIds, assignedAccountCode, isDebitAccount, user.id);

    return NextResponse.json({
      success: true,
      updatedCount: result.updatedCount,
      message: `Successfully assigned accounts to ${result.updatedCount} transaction${result.updatedCount !== 1 ? 's' : ''}`
    });
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json(
      { error: 'Failed to assign accounts to transactions' },
      { status: 500 }
    );
  }
}

export const POST = createAuthHandler(postHandler);