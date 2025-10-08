import { NextRequest, NextResponse } from 'next/server';
import { createAuthHandler, AuthenticatedRequest } from '@/lib/auth-middleware';
import { bulkUpdateTransactionsClassification } from '@/lib/database';

async function postHandler(request: AuthenticatedRequest): Promise<NextResponse> {
  try {
    const user = request.user!;
    const body = await request.json();

    const { transactionIds, classification } = body;

    // Validate required fields
    if (!transactionIds || !Array.isArray(transactionIds) || transactionIds.length === 0) {
      return NextResponse.json(
        { error: 'Transaction IDs array is required' },
        { status: 400 }
      );
    }

    if (!classification) {
      return NextResponse.json(
        { error: 'Classification is required' },
        { status: 400 }
      );
    }

    // Validate classification value
    const validClassifications = ['income', 'expense', 'transfer'];
    if (!validClassifications.includes(classification)) {
      return NextResponse.json(
        { error: 'Invalid classification. Must be income, expense, or transfer' },
        { status: 400 }
      );
    }

    // Update transactions
    const result = await bulkUpdateTransactionsClassification(transactionIds, classification, user.id);

    return NextResponse.json({
      success: true,
      updatedCount: result.updatedCount,
      message: `Successfully updated ${result.updatedCount} transaction${result.updatedCount !== 1 ? 's' : ''}`
    });
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json(
      { error: 'Failed to update transactions' },
      { status: 500 }
    );
  }
}

export const POST = createAuthHandler(postHandler);