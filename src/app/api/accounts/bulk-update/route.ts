import { NextRequest, NextResponse } from 'next/server';
import { createAuthHandler, AuthenticatedRequest } from '@/lib/auth-middleware';
import { bulkUpdateAccountsCategory } from '@/lib/database';

async function postHandler(request: AuthenticatedRequest): Promise<NextResponse> {
  try {
    const user = request.user!;
    const body = await request.json();

    const { accountIds, category } = body;

    // Validate required fields
    if (!accountIds || !Array.isArray(accountIds) || accountIds.length === 0) {
      return NextResponse.json(
        { error: 'Account IDs array is required' },
        { status: 400 }
      );
    }

    if (!category) {
      return NextResponse.json(
        { error: 'Category is required' },
        { status: 400 }
      );
    }

    // Update accounts
    const result = await bulkUpdateAccountsCategory(accountIds, category, user.id);

    return NextResponse.json({
      success: true,
      updatedCount: result.updatedCount,
      message: `Successfully updated ${result.updatedCount} account${result.updatedCount !== 1 ? 's' : ''}`
    });
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json(
      { error: 'Failed to update accounts' },
      { status: 500 }
    );
  }
}

export const POST = createAuthHandler(postHandler);