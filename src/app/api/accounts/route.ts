import { NextRequest, NextResponse } from 'next/server';
import { createAuthHandler, AuthenticatedRequest } from '@/lib/auth-middleware';
import { createAccount } from '@/lib/database';

async function postHandler(request: AuthenticatedRequest): Promise<NextResponse> {
  try {
    const user = request.user!;
    const body = await request.json();

    const { code, alias, category, currency, balance } = body;

    // Validate required fields
    if (!code || !alias || !category) {
      return NextResponse.json(
        { error: 'Code, alias, and category are required' },
        { status: 400 }
      );
    }

    // Create the account
    const newAccount = await createAccount({
      code,
      alias,
      category,
      currency: currency || 'USD',
      balance: balance || 0,
      active: 1,
      userId: user.id
    });

    return NextResponse.json(newAccount, { status: 201 });
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json(
      { error: 'Failed to create account' },
      { status: 500 }
    );
  }
}

export const POST = createAuthHandler(postHandler);