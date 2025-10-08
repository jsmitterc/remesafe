import { NextRequest, NextResponse } from 'next/server';
import { createAuthHandler, AuthenticatedRequest } from '@/lib/auth-middleware';
import { getBalanceSheetData } from '@/lib/database';

async function getHandler(request: AuthenticatedRequest): Promise<NextResponse> {
  try {
    const user = request.user!;
    const { searchParams } = new URL(request.url);

    const timeFrame = searchParams.get('timeFrame');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    let dateFilter = '';
    const params: any[] = [user.id];

    if (timeFrame && timeFrame !== 'custom') {
      // Calculate hours for predefined time frames
      let hours = 24; // default to day
      switch (timeFrame) {
        case 'hour':
          hours = 1;
          break;
        case 'day':
          hours = 24;
          break;
        case 'month':
          hours = 24 * 30;
          break;
        case '3months':
          hours = 24 * 90;
          break;
        case '6months':
          hours = 24 * 180;
          break;
      }
      dateFilter = 'AND t.fecha >= DATE_SUB(NOW(), INTERVAL ? HOUR)';
      params.push(hours);
    } else if (startDate && endDate) {
      // Custom date range
      dateFilter = 'AND t.fecha >= ? AND t.fecha <= ?';
      params.push(startDate, endDate);
    }

    const balanceSheetData = await getBalanceSheetData(user.id, dateFilter, params);

    return NextResponse.json(balanceSheetData);
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch balance sheet data' },
      { status: 500 }
    );
  }
}

export const GET = createAuthHandler(getHandler);