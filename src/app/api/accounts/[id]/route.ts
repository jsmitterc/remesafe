import { NextRequest, NextResponse } from 'next/server';
import { getAccountById, updateAccount } from '@/lib/database';
import { createAuthHandler, AuthenticatedRequest } from '@/lib/auth-middleware';

async function getHandler(
  request: AuthenticatedRequest
): Promise<NextResponse> {
  try {
    const user = request.user!;
    console.log(user);

    // Get account ID from URL (same as PATCH handler)
    const url = new URL(request.url);
    const pathParts = url.pathname.split('/');
    const accountId = parseInt(pathParts[pathParts.length - 1]);

    if (!accountId || isNaN(accountId)) {
      return NextResponse.json({ error: 'Valid account ID is required' }, { status: 400 });
    }

    const account = await getAccountById(accountId);

    console.log(account);

    if (!account) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 });
    }

    return NextResponse.json(account);

  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch account details' },
      { status: 500 }
    );
  }
}

export const GET = createAuthHandler(getHandler);

async function patchHandler(
  request: AuthenticatedRequest
): Promise<NextResponse> {
  try {
    const user = request.user!;

    // Get account ID from URL
    const url = new URL(request.url);
    const pathParts = url.pathname.split('/');
    const accountId = parseInt(pathParts[pathParts.length - 1]);

    if (!accountId || isNaN(accountId)) {
      return NextResponse.json({ error: 'Valid account ID is required' }, { status: 400 });
    }

    const body = await request.json();
    const { account_name, category, account_type, account_status, currency_code } = body;

    // Update account
    const result = await updateAccount(accountId, {
      account_name,
      category,
      account_type,
      account_status,
      currency_code,
    }, user.id);

    if (!result.success) {
      return NextResponse.json({ error: result.error || 'Failed to update account' }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      message: 'Account updated successfully',
    });
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json(
      { error: 'Failed to update account' },
      { status: 500 }
    );
  }
}

export const PATCH = createAuthHandler(patchHandler);