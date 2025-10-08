'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useUserData } from '@/hooks/useUserData';
import DashboardLayout from '@/components/DashboardLayout';

export default function HomePage() {
  const { currentUser } = useAuth();
  const { userData, loading: userDataLoading, error: userDataError } = useUserData(currentUser?.email || null);

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">
            Welcome to Your Dashboard
          </h1>
          <p className="text-lg text-gray-600">
            You are successfully authenticated and logged in!
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-lg p-6 shadow">
            <h2 className="text-xl font-semibold mb-4">Firebase Account Information</h2>
            <div className="space-y-2">
              <p className="text-gray-600">Email: {currentUser?.email}</p>
              <p className="text-gray-600">User ID: {currentUser?.uid}</p>
              <p className="text-gray-600">
                Account created: {currentUser?.metadata.creationTime}
              </p>
            </div>
          </div>

          <div className="bg-white rounded-lg p-6 shadow">
            <h2 className="text-xl font-semibold mb-4">Database User Information</h2>
            {userDataLoading && (
              <div className="flex items-center justify-center py-4">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-500"></div>
                <span className="ml-2 text-gray-600">Loading user data...</span>
              </div>
            )}

            {userDataError && (
              <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded mb-4">
                Error: {userDataError}
              </div>
            )}

            {!userDataLoading && !userDataError && userData && (
              <div className="space-y-2">
                {Object.entries(userData).map(([key, value]) => (
                  <p key={key} className="text-gray-600">
                    <span className="font-medium capitalize">{key.replace('_', ' ')}:</span>{' '}
                    {typeof value === 'object' && value instanceof Date
                      ? value.toLocaleString()
                      : String(value)
                    }
                  </p>
                ))}
              </div>
            )}

            {!userDataLoading && !userDataError && !userData && (
              <p className="text-gray-500 italic">No user data found in database for this email.</p>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}