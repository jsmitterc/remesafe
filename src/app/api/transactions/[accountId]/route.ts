import { NextRequest, NextResponse } from 'next/server';
import { getTransactionsByAccountId } from '@/lib/database';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ accountId: string }> }
) {
  try {
    const { accountId: accountIdParam } = await params;
    const accountId = parseInt(accountIdParam);

    if (!accountId || isNaN(accountId)) {
      return NextResponse.json({ error: 'Valid account ID is required' }, { status: 400 });
    }

    // Get query parameters for pagination
    const searchParams = request.nextUrl.searchParams;
    const limit = Math.min(parseInt(searchParams.get('limit') || '100'), 500); // Max 500 records
    const offset = parseInt(searchParams.get('offset') || '0');

    const transactions = await getTransactionsByAccountId(accountId, limit, offset);

    return NextResponse.json(transactions);
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch transactions data' },
      { status: 500 }
    );
  }
}