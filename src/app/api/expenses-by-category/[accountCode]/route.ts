import { NextRequest, NextResponse } from 'next/server';
import { getExpensesByCategory } from '@/lib/database';

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
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    // Validate date parameters if provided
    if (startDate && isNaN(Date.parse(startDate))) {
      return NextResponse.json({ error: 'Invalid start date format' }, { status: 400 });
    }

    if (endDate && isNaN(Date.parse(endDate))) {
      return NextResponse.json({ error: 'Invalid end date format' }, { status: 400 });
    }

    // Get expenses by category
    const expenses = await getExpensesByCategory(
      accountCode,
      startDate || undefined,
      endDate || undefined
    );

    return NextResponse.json(expenses);

  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch expenses by category' },
      { status: 500 }
    );
  }
}