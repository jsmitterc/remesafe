import { NextRequest, NextResponse } from 'next/server';
import { createAuthHandler, AuthenticatedRequest } from '@/lib/auth-middleware';
import { getAccountsByUserEmail } from '@/lib/database';

async function handler(request: AuthenticatedRequest): Promise<NextResponse> {
  try {
    // User is automatically available from the middleware
    const user = request.user!;

    const accounts = await getAccountsByUserEmail(user.email);

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