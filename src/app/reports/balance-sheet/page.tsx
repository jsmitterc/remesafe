'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import DashboardLayout from '@/components/DashboardLayout';

interface Account {
  id: number;
  code: string;
  alias: string;
  category: string;
  currency: string;
  balance: number;
  transaction_count: number;
}

interface TimeFrame {
  label: string;
  value: string;
  hours?: number;
}

const timeFrames: TimeFrame[] = [
  { label: 'Past Hour', value: 'hour', hours: 1 },
  { label: 'Past Day', value: 'day', hours: 24 },
  { label: 'Past Month', value: 'month', hours: 24 * 30 },
  { label: 'Past 3 Months', value: '3months', hours: 24 * 90 },
  { label: 'Past 6 Months', value: '6months', hours: 24 * 180 },
  { label: 'Custom Range', value: 'custom' }
];

export default function BalanceSheetPage() {
  const router = useRouter();
  const { currentUser } = useAuth();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTimeFrame, setSelectedTimeFrame] = useState('month');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');

  const fetchBalanceSheet = async () => {
    try {
      setLoading(true);

      // Get Firebase ID token
      if (!currentUser) {
        throw new Error('User not authenticated');
      }

      const token = await currentUser.getIdToken();

      let url = `/api/reports/balance-sheet?timeFrame=${selectedTimeFrame}`;

      if (selectedTimeFrame === 'custom' && customStartDate && customEndDate) {
        url = `/api/reports/balance-sheet?startDate=${customStartDate}&endDate=${customEndDate}`;
      }

      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setAccounts(data || []);
      } else {
        throw new Error('Failed to fetch balance sheet data');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (currentUser) {
      fetchBalanceSheet();
    }
  }, [currentUser, selectedTimeFrame, customStartDate, customEndDate]);

  const formatCurrency = (amount: number, currency: string = 'USD') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
    }).format(amount);
  };

  const groupedAccounts = accounts.reduce((acc, account) => {
    if (!acc[account.category]) {
      acc[account.category] = [];
    }
    acc[account.category].push(account);
    return acc;
  }, {} as Record<string, Account[]>);

  const categoryTotals = Object.entries(groupedAccounts).map(([category, categoryAccounts]) => ({
    category,
    total: categoryAccounts.reduce((sum, account) => sum + account.balance, 0),
    accounts: categoryAccounts,
    currency: categoryAccounts[0]?.currency || 'USD'
  }));

  // Calculate totals for all account types
  const assets = categoryTotals.filter(cat => cat.category === 'asset');
  const liabilities = categoryTotals.filter(cat => cat.category === 'liability');
  const equity = categoryTotals.filter(cat => cat.category === 'equity');
  const income = categoryTotals.filter(cat => cat.category === 'income');
  const expenses = categoryTotals.filter(cat => cat.category === 'expense');

  const totalAssets = assets.reduce((sum, cat) => sum + cat.total, 0);
  const totalLiabilities = liabilities.reduce((sum, cat) => sum + cat.total, 0);
  const totalEquity = equity.reduce((sum, cat) => sum + cat.total, 0);
  const totalIncome = income.reduce((sum, cat) => sum + cat.total, 0);
  const totalExpenses = expenses.reduce((sum, cat) => sum + cat.total, 0);

  // Calculate net income
  const netIncome = totalIncome - totalExpenses;

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2 mb-8"></div>
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-16 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <div className="text-red-800">Error: {error}</div>
        </div>
      </div>
    );
  }

  return (
    <DashboardLayout>
      <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Trial Balance Report</h1>
          <p className="text-gray-600 mt-1">Complete view of all accounts grouped by category</p>
        </div>
        <button
          onClick={() => router.back()}
          className="text-indigo-600 hover:text-indigo-800"
        >
          ← Back
        </button>
      </div>

      {/* Time Frame Selection */}
      <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Time Period</h2>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-4">
          {timeFrames.map((timeFrame) => (
            <button
              key={timeFrame.value}
              onClick={() => setSelectedTimeFrame(timeFrame.value)}
              className={`px-3 py-2 text-sm rounded-md border ${
                selectedTimeFrame === timeFrame.value
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
              }`}
            >
              {timeFrame.label}
            </button>
          ))}
        </div>

        {selectedTimeFrame === 'custom' && (
          <div className="flex gap-4 items-center">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">From</label>
              <input
                type="datetime-local"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="border border-gray-300 rounded px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">To</label>
              <input
                type="datetime-local"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="border border-gray-300 rounded px-3 py-2 text-sm"
              />
            </div>
          </div>
        )}
      </div>

      {/* Balance Sheet */}
      <div className="bg-white rounded-lg shadow-sm border">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">
            Trial Balance Report
            {selectedTimeFrame !== 'custom' && (
              <span className="text-sm font-normal text-gray-500 ml-2">
                ({timeFrames.find(tf => tf.value === selectedTimeFrame)?.label})
              </span>
            )}
          </h2>
          <p className="text-sm text-gray-600 mt-1">All accounts grouped by category</p>
        </div>

        <div className="p-6">
          {/* Assets */}
          {assets.length > 0 && (
            <div className="mb-8">
              <h3 className="text-lg font-semibold text-green-800 mb-4 bg-green-50 p-3 rounded">ASSETS</h3>
              {assets.map(({ category, accounts, total, currency }) => (
                <div key={category} className="mb-6">
                  <div className="ml-4">
                    {accounts.map((account) => (
                      <div key={account.id} className="flex justify-between items-center py-2 border-b border-gray-100">
                        <div>
                          <span className="font-medium">{account.code}</span>
                          <span className="text-gray-600 ml-2">{account.alias}</span>
                          <span className="text-xs text-gray-400 ml-2">({account.transaction_count} transactions)</span>
                        </div>
                        <span className="font-medium">{formatCurrency(account.balance, account.currency)}</span>
                      </div>
                    ))}
                    <div className="flex justify-between items-center py-2 font-semibold bg-green-50">
                      <span>Total Assets</span>
                      <span>{formatCurrency(total, currency)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Liabilities */}
          {liabilities.length > 0 && (
            <div className="mb-8">
              <h3 className="text-lg font-semibold text-red-800 mb-4 bg-red-50 p-3 rounded">LIABILITIES</h3>
              {liabilities.map(({ category, accounts, total, currency }) => (
                <div key={category} className="mb-6">
                  <div className="ml-4">
                    {accounts.map((account) => (
                      <div key={account.id} className="flex justify-between items-center py-2 border-b border-gray-100">
                        <div>
                          <span className="font-medium">{account.code}</span>
                          <span className="text-gray-600 ml-2">{account.alias}</span>
                          <span className="text-xs text-gray-400 ml-2">({account.transaction_count} transactions)</span>
                        </div>
                        <span className="font-medium">{formatCurrency(account.balance, account.currency)}</span>
                      </div>
                    ))}
                    <div className="flex justify-between items-center py-2 font-semibold bg-red-50">
                      <span>Total Liabilities</span>
                      <span>{formatCurrency(total, currency)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Equity */}
          {equity.length > 0 && (
            <div className="mb-8">
              <h3 className="text-lg font-semibold text-blue-800 mb-4 bg-blue-50 p-3 rounded">EQUITY</h3>
              {equity.map(({ category, accounts, total, currency }) => (
                <div key={category} className="mb-6">
                  <div className="ml-4">
                    {accounts.map((account) => (
                      <div key={account.id} className="flex justify-between items-center py-2 border-b border-gray-100">
                        <div>
                          <span className="font-medium">{account.code}</span>
                          <span className="text-gray-600 ml-2">{account.alias}</span>
                          <span className="text-xs text-gray-400 ml-2">({account.transaction_count} transactions)</span>
                        </div>
                        <span className="font-medium">{formatCurrency(account.balance, account.currency)}</span>
                      </div>
                    ))}
                    <div className="flex justify-between items-center py-2 font-semibold bg-blue-50">
                      <span>Total Equity</span>
                      <span>{formatCurrency(total, currency)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Income */}
          {income.length > 0 && (
            <div className="mb-8">
              <h3 className="text-lg font-semibold text-purple-800 mb-4 bg-purple-50 p-3 rounded">INCOME</h3>
              {income.map(({ category, accounts, total, currency }) => (
                <div key={category} className="mb-6">
                  <div className="ml-4">
                    {accounts.map((account) => (
                      <div key={account.id} className="flex justify-between items-center py-2 border-b border-gray-100">
                        <div>
                          <span className="font-medium">{account.code}</span>
                          <span className="text-gray-600 ml-2">{account.alias}</span>
                          <span className="text-xs text-gray-400 ml-2">({account.transaction_count} transactions)</span>
                        </div>
                        <span className="font-medium">{formatCurrency(account.balance, account.currency)}</span>
                      </div>
                    ))}
                    <div className="flex justify-between items-center py-2 font-semibold bg-purple-50">
                      <span>Total Income</span>
                      <span>{formatCurrency(total, currency)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Expenses */}
          {expenses.length > 0 && (
            <div className="mb-8">
              <h3 className="text-lg font-semibold text-orange-800 mb-4 bg-orange-50 p-3 rounded">EXPENSES</h3>
              {expenses.map(({ category, accounts, total, currency }) => (
                <div key={category} className="mb-6">
                  <div className="ml-4">
                    {accounts.map((account) => (
                      <div key={account.id} className="flex justify-between items-center py-2 border-b border-gray-100">
                        <div>
                          <span className="font-medium">{account.code}</span>
                          <span className="text-gray-600 ml-2">{account.alias}</span>
                          <span className="text-xs text-gray-400 ml-2">({account.transaction_count} transactions)</span>
                        </div>
                        <span className="font-medium">{formatCurrency(account.balance, account.currency)}</span>
                      </div>
                    ))}
                    <div className="flex justify-between items-center py-2 font-semibold bg-orange-50">
                      <span>Total Expenses</span>
                      <span>{formatCurrency(total, currency)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Summary Section */}
          <div className="border-t-2 border-gray-300 pt-6 mt-8">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">SUMMARY</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Financial Position */}
              <div className="bg-gray-50 p-4 rounded">
                <h4 className="font-semibold text-gray-800 mb-3">Financial Position</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>Total Assets:</span>
                    <span className="font-medium">{formatCurrency(totalAssets)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Total Liabilities:</span>
                    <span className="font-medium">{formatCurrency(totalLiabilities)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Total Equity:</span>
                    <span className="font-medium">{formatCurrency(totalEquity)}</span>
                  </div>
                  <div className="border-t border-gray-300 pt-2 flex justify-between font-semibold">
                    <span>Net Worth (Assets - Liabilities):</span>
                    <span className={totalAssets - totalLiabilities >= 0 ? 'text-green-600' : 'text-red-600'}>
                      {formatCurrency(totalAssets - totalLiabilities)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Performance */}
              <div className="bg-gray-50 p-4 rounded">
                <h4 className="font-semibold text-gray-800 mb-3">Performance</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>Total Income:</span>
                    <span className="font-medium text-green-600">{formatCurrency(totalIncome)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Total Expenses:</span>
                    <span className="font-medium text-red-600">{formatCurrency(totalExpenses)}</span>
                  </div>
                  <div className="border-t border-gray-300 pt-2 flex justify-between font-semibold">
                    <span>Net Income:</span>
                    <span className={netIncome >= 0 ? 'text-green-600' : 'text-red-600'}>
                      {formatCurrency(netIncome)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Balance Check */}
            <div className="mt-4 p-4 bg-blue-50 rounded">
              <div className={`flex justify-between items-center text-sm font-medium ${
                Math.abs(totalAssets - (totalLiabilities + totalEquity)) < 0.01
                  ? 'text-green-700'
                  : 'text-red-700'
              }`}>
                <span>Balance Check (Assets - Liabilities - Equity):</span>
                <span>{formatCurrency(totalAssets - totalLiabilities - totalEquity)}</span>
              </div>
              {Math.abs(totalAssets - (totalLiabilities + totalEquity)) < 0.01 ? (
                <p className="text-xs text-green-600 mt-1">✓ Books are balanced</p>
              ) : (
                <p className="text-xs text-red-600 mt-1">⚠ Books are not balanced - check for errors</p>
              )}
            </div>
          </div>
        </div>
      </div>
      </div>
    </DashboardLayout>
  );
}