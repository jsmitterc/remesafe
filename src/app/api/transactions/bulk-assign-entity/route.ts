import { NextRequest, NextResponse } from 'next/server';
import { createAuthHandler, AuthenticatedRequest } from '@/lib/auth-middleware';
import pool from '@/lib/database';

async function postHandler(request: AuthenticatedRequest): Promise<NextResponse> {
  try {
    const user = request.user!;
    const body = await request.json();

    const { transactionIds, entityId } = body;

    // Validate required fields
    if (!transactionIds || !Array.isArray(transactionIds) || transactionIds.length === 0) {
      return NextResponse.json(
        { error: 'Transaction IDs array is required' },
        { status: 400 }
      );
    }

    if (!entityId) {
      return NextResponse.json(
        { error: 'Entity ID is required' },
        { status: 400 }
      );
    }

    // Create placeholders for the IN clause
    const placeholders = transactionIds.map(() => '?').join(',');

    // Verify that all transactions belong to the user and the entity exists
    const verifyQuery = `
      SELECT
        (SELECT COUNT(*) FROM rv_transaction t
         JOIN rv_cuentas a ON (t.debitacc = a.code OR t.creditacc = a.code)
         WHERE t.id IN (${placeholders}) AND a.user = ?) as transaction_count,
        (SELECT COUNT(*) FROM company WHERE id = ? AND user_id = ?) as entity_count
    `;

    const [verifyResult] = await pool.execute(verifyQuery, [...transactionIds, user.id, entityId, user.id]);
    const { transaction_count, entity_count } = (verifyResult as any)[0];

    if (transaction_count === 0) {
      return NextResponse.json(
        { error: 'No transactions found or access denied' },
        { status: 404 }
      );
    }

    if (entity_count === 0) {
      return NextResponse.json(
        { error: 'Entity not found or access denied' },
        { status: 404 }
      );
    }

    // Update the transactions with the entity
    const updateQuery = `
      UPDATE rv_transaction t
      SET t.company = ?
      WHERE t.id IN (${placeholders})
      AND EXISTS (
        SELECT 1 FROM rv_cuentas a
        WHERE (t.debitacc = a.code OR t.creditacc = a.code)
        AND a.user = ?
      )
    `;

    const params = [entityId, ...transactionIds, user.id];
    const [result] = await pool.execute(updateQuery, params);

    // Get the number of affected rows
    const affectedRows = (result as any).affectedRows || 0;

    return NextResponse.json({
      success: true,
      updatedCount: affectedRows,
      message: `Successfully assigned entity to ${affectedRows} transaction${affectedRows !== 1 ? 's' : ''}`
    });
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json(
      { error: 'Failed to assign entity to transactions' },
      { status: 500 }
    );
  }
}

export const POST = createAuthHandler(postHandler);