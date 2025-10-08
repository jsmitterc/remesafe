import { NextRequest, NextResponse } from 'next/server';
import { createAuthHandler, AuthenticatedRequest } from '@/lib/auth-middleware';
import { getEntitiesByUserId, createEntity } from '@/lib/database';

async function getHandler(request: AuthenticatedRequest): Promise<NextResponse> {
  try {
    const user = request.user!;

    // Get all entities for the user
    const entities = await getEntitiesByUserId(user.id);

    return NextResponse.json(entities);
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch entities' },
      { status: 500 }
    );
  }
}

async function postHandler(request: AuthenticatedRequest): Promise<NextResponse> {
  try {
    const user = request.user!;
    const body = await request.json();

    const {
      code,
      sub_code,
      name,
      companyEmail,
      email,
      whatsapp,
      timezone,
      vat,
      organization_id
    } = body;

    // Validate required fields
    if (!code || !name) {
      return NextResponse.json(
        { error: 'Code and name are required' },
        { status: 400 }
      );
    }

    // Create the entity
    const newEntity = await createEntity({
      code,
      sub_code,
      name,
      companyEmail,
      email,
      whatsapp,
      timezone,
      vat,
      organization_id,
      userId: user.id
    });

    return NextResponse.json(newEntity, { status: 201 });
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json(
      { error: 'Failed to create entity' },
      { status: 500 }
    );
  }
}

export const GET = createAuthHandler(getHandler);
export const POST = createAuthHandler(postHandler);