import { NextRequest, NextResponse } from 'next/server';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getUserByEmail } from './database';

// Initialize Firebase Admin SDK
if (!getApps().length) {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

  console.log('Firebase Admin initialization:', {
    projectId,
    clientEmail: clientEmail ? 'Present' : 'Missing',
    privateKey: privateKey ? 'Present' : 'Missing'
  });

  initializeApp({
    credential: cert({
      projectId: projectId,
      clientEmail: clientEmail,
      privateKey: privateKey,
    }),
  });
}

export interface AuthenticatedUser {
  id: number;
  email: string;
  name?: string;
  created_at?: string;
  updated_at?: string;
  firebaseUid: string;
}

export interface AuthenticatedRequest extends NextRequest {
  user?: AuthenticatedUser;
}

export async function verifyBearerToken(token: string): Promise<AuthenticatedUser | null> {
  try {
    console.log('Verifying token:', token.substring(0, 20) + '...');

    // Verify the Firebase ID token
    const decodedToken = await getAuth().verifyIdToken(token);
    const email = decodedToken.email;

    if (!email) {
      return null;
    }

    // Get user data from database
    const user = await getUserByEmail(email);
    if (!user || !user.id) {
      return null;
    }

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      created_at: user.created_at instanceof Date ? user.created_at.toISOString() : user.created_at,
      updated_at: user.updated_at instanceof Date ? user.updated_at.toISOString() : user.updated_at,
      firebaseUid: decodedToken.uid
    };
  } catch (error) {
    console.error('Token verification failed:', error);
    return null;
  }
}

export async function withAuth(
  request: NextRequest,
  handler: (req: AuthenticatedRequest) => Promise<NextResponse>
): Promise<NextResponse> {
  try {
    const authHeader = request.headers.get('authorization');

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Missing or invalid authorization header' },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    const user = await verifyBearerToken(token);

    if (!user) {
      return NextResponse.json(
        { error: 'Invalid or expired token' },
        { status: 401 }
      );
    }

    // Add user to request
    const authenticatedRequest = request as AuthenticatedRequest;
    authenticatedRequest.user = user;

    return await handler(authenticatedRequest);
  } catch (error) {
    console.error('Auth middleware error:', error);
    return NextResponse.json(
      { error: 'Authentication failed' },
      { status: 500 }
    );
  }
}

export function createAuthHandler(
  handler: (req: AuthenticatedRequest) => Promise<NextResponse>
) {
  return async (request: NextRequest, _context?: unknown) => {
    return withAuth(request, handler);
  };
}