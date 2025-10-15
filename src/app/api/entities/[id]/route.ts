import { NextRequest, NextResponse } from 'next/server';
import { createAuthHandler, AuthenticatedRequest } from '@/lib/auth-middleware';
import pool from '@/lib/database';

async function getHandler(request: AuthenticatedRequest): Promise<NextResponse> {
  try {
    const user = request.user!;

    // Extract entity ID from URL pathname
    const pathname = request.nextUrl.pathname;
    const entityIdMatch = pathname.match(/\/api\/entities\/(\d+)/);

    if (!entityIdMatch) {
      return NextResponse.json(
        { error: 'Invalid entity ID' },
        { status: 400 }
      );
    }

    const entityId = parseInt(entityIdMatch[1]);

    if (isNaN(entityId)) {
      return NextResponse.json(
        { error: 'Invalid entity ID' },
        { status: 400 }
      );
    }

    // Get entity details with access check through company_user table
    const query = `
      SELECT
        c.*,
        COUNT(DISTINCT a.id) as total_accounts,
        COALESCE(SUM(a.balance), 0) as total_balance,
        COUNT(DISTINCT CASE
          WHEN t.debitacc = '0' OR t.creditacc = '0'
          THEN t.id
          ELSE NULL
        END) as incomplete_transactions_count
      FROM company c
      LEFT JOIN company_user cu ON c.id = cu.company_id
      LEFT JOIN rv_cuentas a ON c.id = a.company AND a.active = 1
      LEFT JOIN rv_transaction t ON (t.debitacc = a.code OR t.creditacc = a.code)
      WHERE c.id = ? AND cu.user_id = ?
      GROUP BY c.id, c.code, c.sub_code, c.name, c.companyEmail, c.email, c.whatsapp, c.timezone, c.vat, c.organization_id, c.user_id
    `;

    const [rows] = await pool.execute(query, [entityId, user.id]);
    const entities = rows as any[];

    if (entities.length === 0) {
      return NextResponse.json(
        { error: 'Entity not found or access denied' },
        { status: 404 }
      );
    }

    return NextResponse.json(entities[0]);
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch entity details' },
      { status: 500 }
    );
  }
}

export const GET = createAuthHandler(getHandler);
