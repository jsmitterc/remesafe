import { NextResponse } from 'next/server';
import { createAuthHandler, AuthenticatedRequest } from '@/lib/auth-middleware';
import pool from '@/lib/database';

async function postHandler(
  request: AuthenticatedRequest
): Promise<NextResponse> {
  try {
    const user = request.user!;
    const body = await request.json();
    const { transactionIds, assignedAccountCode } = body;

    if (!Array.isArray(transactionIds) || transactionIds.length === 0) {
      return NextResponse.json({ error: 'Transaction IDs are required' }, { status: 400 });
    }

    if (!assignedAccountCode) {
      return NextResponse.json({ error: 'Account code is required' }, { status: 400 });
    }

    // Verify the assigned account exists and user has access
    const [accountRows] = await pool.execute(
      `SELECT a.code, a.alias, a.company
       FROM rv_cuentas a
       LEFT JOIN company_user cu ON a.company = cu.company_id
       WHERE a.code = ? AND a.active = 1 AND (a.user = ? OR cu.user_id = ?)`,
      [assignedAccountCode, user.id, user.id]
    );

    if ((accountRows as any[]).length === 0) {
      return NextResponse.json({ error: 'Assigned account not found or access denied' }, { status: 400 });
    }

    // Get all selected transactions and check access
    const placeholders = transactionIds.map(() => '?').join(',');
    const [transactionRows] = await pool.execute(
      `SELECT t.id, t.debitacc, t.creditacc, t.company
       FROM rv_transaction t
       LEFT JOIN rv_cuentas a ON (t.debitacc = a.code OR t.creditacc = a.code)
       LEFT JOIN company_user cu ON t.company = cu.company_id
       WHERE t.id IN (${placeholders}) AND (a.user = ? OR cu.user_id = ?)
       GROUP BY t.id`,
      [...transactionIds, user.id, user.id]
    );

    const transactions = transactionRows as Array<{
      id: number;
      debitacc: string;
      creditacc: string;
      company: number;
    }>;

    if (transactions.length === 0) {
      return NextResponse.json({ error: 'No transactions found or access denied' }, { status: 400 });
    }

    let updatedCount = 0;
    let skippedCount = 0;

    // Process each transaction
    for (const transaction of transactions) {
      // Skip if both accounts are already filled
      if (transaction.debitacc !== '0' && transaction.creditacc !== '0') {
        skippedCount++;
        continue;
      }

      // Determine which field to update
      let updateQuery = '';
      if (transaction.debitacc === '0' && transaction.creditacc !== '0') {
        // Update debit account
        updateQuery = 'UPDATE rv_transaction SET debitacc = ? WHERE id = ?';
      } else if (transaction.creditacc === '0' && transaction.debitacc !== '0') {
        // Update credit account
        updateQuery = 'UPDATE rv_transaction SET creditacc = ? WHERE id = ?';
      } else if (transaction.debitacc === '0' && transaction.creditacc === '0') {
        // Both are empty - skip (shouldn't happen in double-entry, but handle it)
        skippedCount++;
        continue;
      }

      if (updateQuery) {
        await pool.execute(updateQuery, [assignedAccountCode, transaction.id]);
        updatedCount++;
      }
    }

    let message = `Successfully assigned ${updatedCount} transaction${updatedCount !== 1 ? 's' : ''}`;
    if (skippedCount > 0) {
      message += `. Skipped ${skippedCount} transaction${skippedCount !== 1 ? 's' : ''} with no empty fields.`;
    }

    return NextResponse.json({
      success: true,
      updatedCount,
      skippedCount,
      message,
    });
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json(
      { error: 'Failed to assign accounts' },
      { status: 500 }
    );
  }
}

export const POST = createAuthHandler(postHandler);
