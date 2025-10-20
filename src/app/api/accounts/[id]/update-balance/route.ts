import { NextResponse } from 'next/server';
import { updateSingleAccountBalance } from '@/lib/database';
import { createAuthHandler, AuthenticatedRequest } from '@/lib/auth-middleware';

async function postHandler(
  request: AuthenticatedRequest
): Promise<NextResponse> {
  try {
    const user = request.user!;

    // Get account ID from URL
    const url = new URL(request.url);
    const pathParts = url.pathname.split('/');
    const accountId = parseInt(pathParts[pathParts.length - 2]); // -2 because last is 'update-balance'

    if (!accountId || isNaN(accountId)) {
      return NextResponse.json({ error: 'Valid account ID is required' }, { status: 400 });
    }

    // Update the account balance
    const result = await updateSingleAccountBalance(accountId, user.id);

    if (!result.success) {
      return NextResponse.json({ error: result.error || 'Failed to update account balance' }, { status: 400 });
    }

    // Convert to numbers to ensure toFixed works
    const prevBalance = Number(result.previousBalance) || 0;
    const newBalance = Number(result.newBalance) || 0;

    return NextResponse.json({
      success: true,
      message: `Account balance updated from ${prevBalance.toFixed(2)} to ${newBalance.toFixed(2)}`,
      previousBalance: prevBalance,
      newBalance: newBalance,
    });
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json(
      { error: 'Failed to update account balance' },
      { status: 500 }
    );
  }
}

export const POST = createAuthHandler(postHandler);
