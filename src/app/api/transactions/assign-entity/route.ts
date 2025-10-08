import { NextRequest, NextResponse } from 'next/server';
import { createAuthHandler, AuthenticatedRequest } from '@/lib/auth-middleware';
import pool from '@/lib/database';

async function postHandler(request: AuthenticatedRequest): Promise<NextResponse> {
  try {
    const user = request.user!;
    const body = await request.json();

    const { transactionId, entityId } = body;

    // Validate required fields
    if (!transactionId) {
      return NextResponse.json(
        { error: 'Transaction ID is required' },
        { status: 400 }
      );
    }

    if (!entityId) {
      return NextResponse.json(
        { error: 'Entity ID is required' },
        { status: 400 }
      );
    }

    // Verify that the transaction belongs to the user and the entity exists
    const verifyQuery = `
      SELECT
        t.id as transaction_id,
        c.id as entity_id
      FROM rv_transaction t
      JOIN rv_cuentas a ON (t.debitacc = a.code OR t.creditacc = a.code)
      LEFT JOIN company c ON c.id = ? AND c.user_id = ?
      WHERE t.id = ? AND a.user = ?
    `;

    const [verifyResult] = await pool.execute(verifyQuery, [entityId, user.id, transactionId, user.id]);
    const verifyData = verifyResult as any[];

    if (verifyData.length === 0) {
      return NextResponse.json(
        { error: 'Transaction not found or access denied' },
        { status: 404 }
      );
    }

    if (!verifyData[0].entity_id) {
      return NextResponse.json(
        { error: 'Entity not found or access denied' },
        { status: 404 }
      );
    }

    // Update the transaction with the entity
    const updateQuery = `
      UPDATE rv_transaction
      SET company = ?
      WHERE id = ?
    `;

    const [result] = await pool.execute(updateQuery, [entityId, transactionId]);

    const affectedRows = (result as any).affectedRows;

    if (affectedRows === 0) {
      return NextResponse.json(
        { error: 'Failed to assign entity to transaction' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Entity assigned to transaction successfully'
    });
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json(
      { error: 'Failed to assign entity to transaction' },
      { status: 500 }
    );
  }
}

export const POST = createAuthHandler(postHandler);