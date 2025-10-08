'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useAccountsData } from '@/hooks/useAccountsData';
import DashboardLayout from '@/components/DashboardLayout';
import {
  ChartBarIcon,
  CurrencyDollarIcon,
  ArrowTrendingDownIcon,
  ArrowTrendingUpIcon,
  ArrowPathIcon,
  CalendarIcon
} from '@heroicons/react/24/outline';
import { Account } from '@/lib/database';

interface FinancialSummary {
  totalIncome: number;
  totalExpenses: number;
  netIncome: number;
  incomeTransactions: number;
  expenseTransactions: number;
  transferTransactions: number;
}

interface ExpenseCategory {
  otherAccountAlias: string;
  otherAccountCode: string;
  totalAmount: number;
  transactionCount: number;
}

export default function ReportsPage() {
  const { currentUser } = useAuth();
  const { accounts, loading: accountsLoading } = useAccountsData();

  const [selectedAccountId, setSelectedAccountId] = useState<number | null>(null);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [financialSummary, setFinancialSummary] = useState<FinancialSummary | null>(null);
  const [expenseCategories, setExpenseCategories] = useState<ExpenseCategory[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Set default date range (last 30 days)
  useEffect(() => {
    const today = new Date();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(today.getDate() - 30);

    setEndDate(today.toISOString().split('T')[0]);
    setStartDate(thirtyDaysAgo.toISOString().split('T')[0]);
  }, []);

  // Auto-select first account when accounts load
  useEffect(() => {
    if (accounts.length > 0 && !selectedAccountId) {
      const activeAccounts = accounts.filter(account => account.active === 1);
      if (activeAccounts.length > 0) {
        setSelectedAccountId(activeAccounts[0].id);
      }
    }
  }, [accounts, selectedAccountId]);

  // Fetch financial data when account or dates change
  useEffect(() => {
    if (selectedAccountId && startDate && endDate) {
      fetchFinancialData();
    }
  }, [selectedAccountId, startDate, endDate]);

  const fetchFinancialData = async () => {
    if (!selectedAccountId) return;

    setLoading(true);
    setError('');

    try {
      const account = accounts.find(acc => acc.id === selectedAccountId);
      if (!account) return;

      // Fetch financial summary
      const summaryResponse = await fetch(`/api/financial-summary/${account.code}?startDate=${startDate}&endDate=${endDate}`);
      const summaryData = await summaryResponse.json();

      if (summaryResponse.ok) {
        setFinancialSummary(summaryData);
      } else {
        setError(summaryData.error || 'Failed to fetch financial summary');
      }

      // Fetch expense categories
      const expensesResponse = await fetch(`/api/expenses-by-category/${account.code}?startDate=${startDate}&endDate=${endDate}`);
      const expensesData = await expensesResponse.json();

      if (expensesResponse.ok) {
        setExpenseCategories(expensesData);
      } else {
        console.error('Failed to fetch expenses:', expensesData.error);
      }

    } catch (err) {
      setError('Network error occurred');
      console.error('Financial data fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

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

  const selectedAccount = accounts.find(acc => acc.id === selectedAccountId);
  const activeAccounts = accounts.filter(account => account.active === 1);

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 flex items-center">
                <ChartBarIcon className="h-8 w-8 text-indigo-600 mr-3" />
                Financial Reports
              </h1>
              <p className="text-gray-600 mt-1">
                Income, expenses, and financial performance analysis
              </p>
            </div>
            <button
              onClick={fetchFinancialData}
              disabled={loading || !selectedAccountId}
              className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
            >
              <ArrowPathIcon className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>

          {/* Additional Reports Navigation */}
          <div className="border-t border-gray-200 pt-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Other Reports</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <a
                href="/reports/balance-sheet"
                className="group relative bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200 p-4 hover:shadow-md transition-all duration-200"
              >
                <div className="flex items-center">
                  <div className="bg-blue-500 rounded-lg p-2 mr-3">
                    <ChartBarIcon className="h-5 w-5 text-white" />
                  </div>
                  <div className="flex-1">
                    <h4 className="text-sm font-medium text-blue-900 group-hover:text-blue-700">
                      Balance Sheet
                    </h4>
                    <p className="text-xs text-blue-700 mt-1">
                      Assets, liabilities & equity with time filters
                    </p>
                  </div>
                </div>
                <div className="mt-2 flex items-center text-xs text-blue-600 group-hover:text-blue-500">
                  View Report
                  <svg className="ml-1 h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </a>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label htmlFor="account" className="block text-sm font-medium text-gray-700 mb-1">
                Account
              </label>
              <select
                id="account"
                value={selectedAccountId || ''}
                onChange={(e) => setSelectedAccountId(parseInt(e.target.value) || null)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              >
                <option value="">Select an account</option>
                {activeAccounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.alias} ({account.code})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="startDate" className="block text-sm font-medium text-gray-700 mb-1">
                From Date
              </label>
              <div className="relative">
                <input
                  type="date"
                  id="startDate"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
                <CalendarIcon className="absolute right-3 top-2.5 h-5 w-5 text-gray-400 pointer-events-none" />
              </div>
            </div>
            <div>
              <label htmlFor="endDate" className="block text-sm font-medium text-gray-700 mb-1">
                To Date
              </label>
              <div className="relative">
                <input
                  type="date"
                  id="endDate"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
                <CalendarIcon className="absolute right-3 top-2.5 h-5 w-5 text-gray-400 pointer-events-none" />
              </div>
            </div>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-md">
            {error}
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
            <span className="ml-3 text-gray-600">Loading financial data...</span>
          </div>
        )}

        {/* Financial Summary Cards */}
        {financialSummary && !loading && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              {/* Total Income */}
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <ArrowTrendingDownIcon className="h-8 w-8 text-green-600" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-500 truncate">Total Income</p>
                    <p className="text-2xl font-semibold text-gray-900">
                      {formatCurrency(financialSummary.totalIncome, selectedAccount?.currency || 'USD')}
                    </p>
                  </div>
                </div>
                <div className="mt-2">
                  <span className="text-sm text-gray-500">
                    {financialSummary.incomeTransactions} transactions
                  </span>
                </div>
              </div>

              {/* Total Expenses */}
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <ArrowTrendingUpIcon className="h-8 w-8 text-red-600" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-500 truncate">Total Expenses</p>
                    <p className="text-2xl font-semibold text-gray-900">
                      {formatCurrency(financialSummary.totalExpenses, selectedAccount?.currency || 'USD')}
                    </p>
                  </div>
                </div>
                <div className="mt-2">
                  <span className="text-sm text-gray-500">
                    {financialSummary.expenseTransactions} transactions
                  </span>
                </div>
              </div>

              {/* Net Income */}
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <CurrencyDollarIcon className={`h-8 w-8 ${financialSummary.netIncome >= 0 ? 'text-green-600' : 'text-red-600'}`} />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-500 truncate">Net Income</p>
                    <p className={`text-2xl font-semibold ${financialSummary.netIncome >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {formatCurrency(financialSummary.netIncome, selectedAccount?.currency || 'USD')}
                    </p>
                  </div>
                </div>
                <div className="mt-2">
                  <span className="text-sm text-gray-500">
                    Income - Expenses
                  </span>
                </div>
              </div>

              {/* Transfers */}
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <ArrowPathIcon className="h-8 w-8 text-blue-600" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-500 truncate">Transfers</p>
                    <p className="text-2xl font-semibold text-gray-900">
                      {financialSummary.transferTransactions}
                    </p>
                  </div>
                </div>
                <div className="mt-2">
                  <span className="text-sm text-gray-500">
                    Internal transfers
                  </span>
                </div>
              </div>
            </div>

            {/* Expense Categories */}
            {expenseCategories.length > 0 && (
              <div className="bg-white rounded-lg shadow">
                <div className="px-6 py-4 border-b border-gray-200">
                  <h3 className="text-lg font-medium text-gray-900">Top Expense Categories</h3>
                  <p className="text-sm text-gray-500">Breakdown of expenses by account</p>
                </div>
                <div className="p-6">
                  <div className="space-y-4">
                    {expenseCategories.slice(0, 10).map((category, index) => {
                      const percentage = financialSummary.totalExpenses > 0
                        ? (category.totalAmount / financialSummary.totalExpenses) * 100
                        : 0;

                      return (
                        <div key={category.otherAccountCode} className="flex items-center justify-between">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center">
                              <div className="flex-shrink-0 h-10 w-10 bg-gray-100 rounded-lg flex items-center justify-center">
                                <span className="text-sm font-medium text-gray-600">
                                  {index + 1}
                                </span>
                              </div>
                              <div className="ml-4 min-w-0 flex-1">
                                <p className="text-sm font-medium text-gray-900 truncate">
                                  {category.otherAccountAlias}
                                </p>
                                <p className="text-sm text-gray-500 truncate">
                                  {category.otherAccountCode} • {category.transactionCount} transactions
                                </p>
                              </div>
                            </div>
                          </div>
                          <div className="flex-shrink-0 ml-4 text-right">
                            <p className="text-sm font-medium text-gray-900">
                              {formatCurrency(category.totalAmount, selectedAccount?.currency || 'USD')}
                            </p>
                            <p className="text-sm text-gray-500">
                              {percentage.toFixed(1)}%
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {expenseCategories.length > 10 && (
                    <div className="mt-4 text-center">
                      <p className="text-sm text-gray-500">
                        Showing top 10 of {expenseCategories.length} categories
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}

        {/* Empty State */}
        {!loading && !financialSummary && selectedAccountId && (
          <div className="text-center py-12">
            <ChartBarIcon className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">No financial data</h3>
            <p className="mt-1 text-sm text-gray-500">
              No transactions found for the selected account and date range.
            </p>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}