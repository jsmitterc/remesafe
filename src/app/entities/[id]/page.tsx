'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import DashboardLayout from '@/components/DashboardLayout';
import {
  ArrowLeftIcon,
  ArrowPathIcon,
  BuildingOfficeIcon,
  UserGroupIcon,
  CreditCardIcon,
  ExclamationTriangleIcon,
  EnvelopeIcon,
  PhoneIcon,
  MapPinIcon
} from '@heroicons/react/24/outline';

interface Entity {
  id: number;
  code: string;
  sub_code: string | null;
  name: string | null;
  companyEmail: string | null;
  email: number;
  whatsapp: number;
  timezone: string | null;
  vat: number;
  organization_id: number | null;
  user_id: number | null;
  total_accounts?: number;
  total_balance?: number;
  incomplete_transactions_count?: number;
}

interface EntityUser {
  id: number;
  email: string;
  name?: string;
  role?: string;
  created_at?: string;
}

interface Account {
  id: number;
  code: string;
  alias: string;
  category: string | null;
  currency: string;
  balance: number;
  viewBalance: boolean;
  incomplete_transactions_count?: number;
}

export default function EntityDetailPage() {
  const router = useRouter();
  const params = useParams();
  const { currentUser } = useAuth();
  const entityId = params.id as string;

  const [entity, setEntity] = useState<Entity | null>(null);
  const [users, setUsers] = useState<EntityUser[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    if (!currentUser) return;

    try {
      setLoading(true);
      setError(null);

      const token = await currentUser.getIdToken();

      // Fetch all data in parallel
      const [entityRes, usersRes, accountsRes] = await Promise.all([
        fetch(`/api/entities/${entityId}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch(`/api/entities/${entityId}/users`, {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch(`/api/entities/${entityId}/accounts`, {
          headers: { 'Authorization': `Bearer ${token}` }
        })
      ]);

      if (!entityRes.ok) {
        throw new Error('Failed to fetch entity details');
      }

      const entityData = await entityRes.json();
      const usersData = usersRes.ok ? await usersRes.json() : [];
      const accountsData = accountsRes.ok ? await accountsRes.json() : [];

      setEntity(entityData);
      setUsers(usersData);
      setAccounts(accountsData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [currentUser, entityId]);

  const formatCurrency = (amount: number, currency: string) => {
    const validCurrencies = new Set([
      'USD', 'EUR', 'GBP', 'JPY', 'AUD', 'CAD', 'CHF', 'CNY', 'SEK', 'NZD',
      'MXN', 'SGD', 'HKD', 'NOK', 'TRY', 'ZAR', 'BRL', 'INR', 'KRW', 'RUB',
      'PLN', 'THB', 'TWD', 'DKK', 'CZK', 'HUF', 'ILS', 'CLP', 'PHP', 'AED',
      'COP', 'SAR', 'MYR', 'RON', 'BGN', 'HRK', 'ISK', 'QAR', 'KWD', 'BHD'
    ]);

    const currencyCode = currency?.toUpperCase() || 'USD';

    try {
      if (validCurrencies.has(currencyCode)) {
        return new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: currencyCode
        }).format(amount);
      } else {
        return new Intl.NumberFormat('en-US', {
          style: 'decimal',
          minimumFractionDigits: 2,
          maximumFractionDigits: 2
        }).format(amount) + ' ' + currency;
      }
    } catch (error) {
      return `${amount.toFixed(2)} ${currency || ''}`;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
          <span className="ml-3 text-gray-600">Loading entity details...</span>
        </div>
      </DashboardLayout>
    );
  }

  if (error || !entity) {
    return (
      <DashboardLayout>
        <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-md">
          Error: {error || 'Entity not found'}
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={() => router.push('/entities')}
              className="inline-flex items-center text-gray-600 hover:text-gray-900"
            >
              <ArrowLeftIcon className="h-5 w-5 mr-2" />
              Back to Entities
            </button>
            <button
              onClick={fetchData}
              className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              <ArrowPathIcon className="h-4 w-4 mr-2" />
              Refresh
            </button>
          </div>

          <div className="flex items-start">
            <div className="flex-shrink-0">
              <div className="w-16 h-16 bg-indigo-100 rounded-lg flex items-center justify-center">
                <BuildingOfficeIcon className="h-8 w-8 text-indigo-600" />
              </div>
            </div>
            <div className="ml-6 flex-1">
              <h1 className="text-3xl font-bold text-gray-900">{entity.name || 'Unnamed Entity'}</h1>
              <div className="mt-2 flex items-center space-x-4 text-sm text-gray-500">
                <span className="font-medium">Code: {entity.code}</span>
                {entity.sub_code && <span>Sub: {entity.sub_code}</span>}
                {entity.vat > 0 && <span className="bg-gray-100 px-2 py-1 rounded">VAT: {entity.vat}%</span>}
              </div>
              <div className="mt-4 flex items-center space-x-6">
                {entity.companyEmail && (
                  <div className="flex items-center text-gray-600">
                    <EnvelopeIcon className="h-5 w-5 mr-2" />
                    {entity.companyEmail}
                  </div>
                )}
                {entity.timezone && (
                  <div className="flex items-center text-gray-600">
                    <MapPinIcon className="h-5 w-5 mr-2" />
                    {entity.timezone}
                  </div>
                )}
              </div>
              <div className="mt-3 flex items-center space-x-3">
                {entity.email === 1 && (
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
                    <EnvelopeIcon className="h-4 w-4 mr-1" />
                    Email Enabled
                  </span>
                )}
                {entity.whatsapp === 1 && (
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
                    <PhoneIcon className="h-4 w-4 mr-1" />
                    WhatsApp Enabled
                  </span>
                )}
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm text-gray-500">Total Balance</div>
              <div className={`text-3xl font-bold ${
                (entity.total_balance || 0) >= 0 ? 'text-green-600' : 'text-red-600'
              }`}>
                {formatCurrency(entity.total_balance || 0, 'USD')}
              </div>
              {(entity.incomplete_transactions_count || 0) > 0 && (
                <div className="mt-2 inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-yellow-100 text-yellow-800">
                  <ExclamationTriangleIcon className="h-4 w-4 mr-1" />
                  {entity.incomplete_transactions_count} incomplete
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Associated Users */}
        <div className="bg-white rounded-lg shadow">
          <div className="border-b border-gray-200 p-6">
            <div className="flex items-center">
              <UserGroupIcon className="h-6 w-6 text-gray-400 mr-3" />
              <h2 className="text-xl font-bold text-gray-900">Associated Users</h2>
              <span className="ml-3 text-sm text-gray-500">({users.length})</span>
            </div>
          </div>
          <div className="p-6">
            {users.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No users associated with this entity
              </div>
            ) : (
              <div className="space-y-4">
                {users.map((user) => (
                  <div
                    key={user.id}
                    className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition"
                  >
                    <div className="flex items-center">
                      <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center">
                        <span className="text-indigo-600 font-semibold">
                          {user.name?.charAt(0) || user.email.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-gray-900">
                          {user.name || 'Unnamed User'}
                        </div>
                        <div className="text-sm text-gray-500">{user.email}</div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-4">
                      {user.role && (
                        <span className="px-3 py-1 text-xs font-semibold rounded-full bg-purple-100 text-purple-800">
                          {user.role}
                        </span>
                      )}
                      {user.created_at && (
                        <span className="text-xs text-gray-500">
                          Added {formatDate(user.created_at)}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Connected Accounts */}
        <div className="bg-white rounded-lg shadow">
          <div className="border-b border-gray-200 p-6">
            <div className="flex items-center">
              <CreditCardIcon className="h-6 w-6 text-gray-400 mr-3" />
              <h2 className="text-xl font-bold text-gray-900">Connected Accounts</h2>
              <span className="ml-3 text-sm text-gray-500">({accounts.length})</span>
            </div>
          </div>
          <div className="p-6">
            {accounts.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No accounts connected to this entity
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Account
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Code
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Category
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Balance
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {accounts.map((account) => (
                      <tr
                        key={account.id}
                        className="hover:bg-gray-50 cursor-pointer"
                        onClick={() => router.push(`/accounts/${account.id}`)}
                      >
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">
                            {account.alias}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-500">{account.code}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                            {account.category || 'Uncategorized'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className={`text-sm font-medium ${
                            account.balance >= 0 ? 'text-green-600' : 'text-red-600'
                          }`}>
                            {account.viewBalance ? formatCurrency(account.balance, account.currency) : '****'}
                          </div>
                          <div className="text-xs text-gray-500">
                            {account.currency}
                            {(account.incomplete_transactions_count || 0) > 0 && (
                              <span className="ml-2 text-yellow-600">
                                {account.incomplete_transactions_count} incomplete
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-indigo-600 hover:text-indigo-900">
                          View Details
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
