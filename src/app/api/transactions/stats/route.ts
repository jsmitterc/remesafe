import { NextResponse } from 'next/server';
import { createAuthHandler, AuthenticatedRequest } from '@/lib/auth-middleware';
import pool from '@/lib/database';

interface TransactionStat {
  date: string;
  count: number;
  totalAmount: number;
}

async function getHandler(
  request: AuthenticatedRequest
): Promise<NextResponse> {
  try {
    const user = request.user!;
    const { searchParams } = new URL(request.url);

    // Get query parameters
    const entityId = searchParams.get('entity');
    const accountId = searchParams.get('accountId');
    const days = parseInt(searchParams.get('days') || '30'); // Default to last 30 days

    let query: string;
    let params: any[];

    if (accountId) {
      // Query for specific account - join account by ID and get its transactions
      // Apply signed amounts based on account type and debit/credit
      query = `
          SELECT
            DATE(t.fecha) AS date,
            COUNT(t.id) as count,
            SUM(
              CASE
                -- For asset and expense accounts: debit is positive, credit is negative
                WHEN c.account_type IN ('asset', 'expense') THEN
                  CASE
                    WHEN t.debitacc = c.code THEN t.debit
                    WHEN t.creditacc = c.code THEN -t.credit
                    ELSE 0
                  END
                -- For liability, equity, and income accounts: credit is positive, debit is negative
                ELSE
                  CASE
                    WHEN t.creditacc = c.code THEN t.credit
                    WHEN t.debitacc = c.code THEN -t.debit
                    ELSE 0
                  END
              END
            ) as totalAmount
          FROM rv_transaction t
          JOIN rv_cuentas c ON t.company = c.company
          WHERE
            c.id = ?
            AND (
              t.debitacc = c.code OR
              t.creditacc = c.code
            )
            AND t.fecha >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
            AND EXISTS (
              SELECT 1
              FROM company_user cu
              WHERE cu.company_id = c.company
            )
      `;

      params = [parseInt(accountId), days];

      // Add entity filter if provided
      if (entityId) {
        query += ' AND t.company = ?';
        params.push(parseInt(entityId));
      }
    } else {
      // Query for all user's transactions
      // Use DISTINCT to handle company_user duplicates
      query = `
        SELECT
          DATE(t.fecha) as date,
          COUNT(DISTINCT t.id) as count,
          SUM(t.amount_sum) as totalAmount
        FROM (
          SELECT DISTINCT
            t.id,
            t.fecha,
            GREATEST(t.debit, t.credit) as amount_sum
          FROM rv_transaction t
          LEFT JOIN rv_cuentas a ON (t.debitacc = a.code OR t.creditacc = a.code)
          LEFT JOIN company_user cu ON t.company = cu.company_id
          WHERE
            (a.user = ? OR cu.user_id = ?)
            AND t.fecha >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
        ) as t
      `;

      params = [user.id, user.id, days];

      // Add entity filter if provided
      if (entityId) {
        query = `
          SELECT
            DATE(t.fecha) as date,
            COUNT(DISTINCT t.id) as count,
            SUM(t.amount_sum) as totalAmount
          FROM (
            SELECT DISTINCT
              t.id,
              t.fecha,
              t.company,
              GREATEST(t.debit, t.credit) as amount_sum
            FROM rv_transaction t
            LEFT JOIN rv_cuentas a ON (t.debitacc = a.code OR t.creditacc = a.code)
            LEFT JOIN company_user cu ON t.company = cu.company_id
            WHERE
              (a.user = ? OR cu.user_id = ?)
              AND t.fecha >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
              AND t.company = ?
          ) as t
        `;
        params = [user.id, user.id, days, parseInt(entityId)];
      }
    }

    query += ' GROUP BY DATE(t.fecha) ORDER BY DATE(t.fecha) ASC';

    console.log(query, params);

    const [rows] = await pool.execute(query, params);

    const stats = (rows as any[]).map(row => ({
      date: row.date,
      count: parseInt(row.count),
      totalAmount: parseFloat(row.totalAmount) || 0,
    }));

    return NextResponse.json(stats);
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch transaction statistics' },
      { status: 500 }
    );
  }
}

export const GET = createAuthHandler(getHandler);
