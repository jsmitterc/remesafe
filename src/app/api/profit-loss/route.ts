import { NextRequest, NextResponse } from 'next/server';
import { createAuthHandler, AuthenticatedRequest } from '@/lib/auth-middleware';
import { getProfitLossData } from '@/lib/database';

async function getHandler(request: AuthenticatedRequest): Promise<NextResponse> {
  try {
    const user = request.user!;
    const { searchParams } = new URL(request.url);

    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');
    const entityId = searchParams.get('entity_id');
    const currency = searchParams.get('currency');

    // Validate required parameters
    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: 'start_date and end_date parameters are required' },
        { status: 400 }
      );
    }

    // Validate date format (YYYY-MM-DD)
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(startDate) || !dateRegex.test(endDate)) {
      return NextResponse.json(
        { error: 'Dates must be in YYYY-MM-DD format' },
        { status: 400 }
      );
    }

    // Validate date range
    if (new Date(startDate) > new Date(endDate)) {
      return NextResponse.json(
        { error: 'start_date must be before or equal to end_date' },
        { status: 400 }
      );
    }

    // Validate entity ID if provided
    let entityIdInt: number | undefined;
    if (entityId) {
      entityIdInt = parseInt(entityId);
      if (isNaN(entityIdInt)) {
        return NextResponse.json(
          { error: 'entity_id must be a valid number' },
          { status: 400 }
        );
      }
    }

    // Get profit & loss data
    const plData = await getProfitLossData(startDate, endDate, user.id, entityIdInt, currency || undefined);

    return NextResponse.json(plData);
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch profit & loss data' },
      { status: 500 }
    );
  }
}

export const GET = createAuthHandler(getHandler);