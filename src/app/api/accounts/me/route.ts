import { NextRequest, NextResponse } from 'next/server';
import { createAuthHandler, AuthenticatedRequest } from '@/lib/auth-middleware';
import { getAccountsByUserId, getAccountsByEntityId } from '@/lib/database';

async function handler(request: AuthenticatedRequest): Promise<NextResponse> {
  try {
    // User is automatically available from the middleware
    const user = request.user!;

    // Get entity_id from query params if provided
    const { searchParams } = new URL(request.url);
    const entityId = searchParams.get('entity_id');

    let accounts;
    if (entityId) {
      // Filter by entity
      accounts = await getAccountsByEntityId(parseInt(entityId), user.id);
    } else {
      // Get all accounts for user
      accounts = await getAccountsByUserId(user.id);
    }

    return NextResponse.json(accounts);
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch accounts data' },
      { status: 500 }
    );
  }
}

export const GET = createAuthHandler(handler);