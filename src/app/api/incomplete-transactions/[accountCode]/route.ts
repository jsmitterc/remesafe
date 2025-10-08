import { NextRequest, NextResponse } from 'next/server';
import { getIncompleteTransactionsByAccount } from '@/lib/database';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ accountCode: string }> }
) {
  try {
    const { accountCode } = await params;

    if (!accountCode) {
      return NextResponse.json({ error: 'Account code is required' }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '100');
    const offset = parseInt(searchParams.get('offset') || '0');

    const transactions = await getIncompleteTransactionsByAccount(accountCode, limit, offset);

    return NextResponse.json({ transactions });

  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch incomplete transactions' },
      { status: 500 }
    );
  }
}