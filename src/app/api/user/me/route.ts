import { NextRequest, NextResponse } from 'next/server';
import { createAuthHandler, AuthenticatedRequest } from '@/lib/auth-middleware';

async function handler(request: AuthenticatedRequest): Promise<NextResponse> {
  try {
    // User is automatically available from the middleware
    const user = request.user!;

    // Return user data (excluding sensitive information)
    const { ...userData } = user;
    return NextResponse.json(userData);
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch user data' },
      { status: 500 }
    );
  }
}

export const GET = createAuthHandler(handler);