import { NextRequest, NextResponse } from 'next/server';
import { createAuthHandler, AuthenticatedRequest } from '@/lib/auth-middleware';
import pool from '@/lib/database';

async function getHandler(request: AuthenticatedRequest): Promise<NextResponse> {
  try {
    const user = request.user!;

    // Get all unique currencies from user's accounts
    const query = `
      SELECT DISTINCT currency
      FROM rv_cuentas
      WHERE user = ? AND active = 1 AND currency IS NOT NULL AND currency != ''
      ORDER BY currency ASC
    `;

    const [rows] = await pool.execute(query, [user.id]);
    const currencies = (rows as { currency: string }[]).map(row => row.currency);

    return NextResponse.json(currencies);
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch currencies' },
      { status: 500 }
    );
  }
}

export const GET = createAuthHandler(getHandler);