import { NextResponse } from 'next/server';
import { createAuthHandler, AuthenticatedRequest } from '@/lib/auth-middleware';
import { updateEntityAccountBalances } from '@/lib/database';

async function postHandler(
  request: AuthenticatedRequest
): Promise<NextResponse> {
  try {
    const user = request.user!;

    // Get entity ID from URL
    const url = new URL(request.url);
    const pathParts = url.pathname.split('/');
    const entityIdIndex = pathParts.indexOf('entities') + 1;
    const entityId = parseInt(pathParts[entityIdIndex]);

    if (!entityId || isNaN(entityId)) {
      return NextResponse.json({ error: 'Valid entity ID is required' }, { status: 400 });
    }

    // Update account balances for this entity
    const result = await updateEntityAccountBalances(entityId, user.id);

    if (!result.success) {
      return NextResponse.json({ error: result.error || 'Failed to update balances' }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      message: `Successfully updated ${result.updatedCount} account${result.updatedCount !== 1 ? 's' : ''}`,
      updatedCount: result.updatedCount
    });
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json(
      { error: 'Failed to update account balances' },
      { status: 500 }
    );
  }
}

export const POST = createAuthHandler(postHandler);
