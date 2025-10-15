import { NextRequest, NextResponse } from 'next/server';
import { createAuthHandler, AuthenticatedRequest } from '@/lib/auth-middleware';
import { getAccountsByEntityId } from '@/lib/database';

async function getHandler(request: AuthenticatedRequest): Promise<NextResponse> {
  try {
    const user = request.user!;

    // Extract entity ID from URL pathname
    const pathname = request.nextUrl.pathname;
    const entityIdMatch = pathname.match(/\/api\/entities\/(\d+)/);

    if (!entityIdMatch) {
      return NextResponse.json(
        { error: 'Invalid entity ID' },
        { status: 400 }
      );
    }

    const entityId = parseInt(entityIdMatch[1]);

    if (isNaN(entityId)) {
      return NextResponse.json(
        { error: 'Invalid entity ID' },
        { status: 400 }
      );
    }

    const accounts = await getAccountsByEntityId(entityId, user.id);
    return NextResponse.json(accounts);
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch entity accounts' },
      { status: 500 }
    );
  }
}

export const GET = createAuthHandler(getHandler);
