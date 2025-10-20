import { NextRequest, NextResponse } from 'next/server';
import { createAuthHandler, AuthenticatedRequest } from '@/lib/auth-middleware';
import { createAccount } from '@/lib/database';

async function postHandler(request: AuthenticatedRequest): Promise<NextResponse> {
  try {
    const user = request.user!;
    const body = await request.json();

    const { company, code, alias, category, account_type, currency, balance, active } = body;

    // Validate required fields
    if (!code || !alias || !category || !company) {
      return NextResponse.json(
        { error: 'Code, alias, category, and entity are required' },
        { status: 400 }
      );
    }

    // Create the account
    const newAccount = await createAccount({
      code,
      alias,
      category,
      account_type: account_type || category, // Use account_type if provided, otherwise fallback to category
      currency: currency || 'USD',
      balance: balance || 0,
      active: active !== undefined ? active : 1,
      userId: user.id,
      companyId: company
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