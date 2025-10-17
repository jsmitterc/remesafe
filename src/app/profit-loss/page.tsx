'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import DashboardLayout from '@/components/DashboardLayout';

interface PLAccount {
  code: string;
  alias: string;
  category: string;
  account_type: string;
  total_balance: number;
  currency: string;
}

interface PLData {
  income_accounts: PLAccount[];
  expense_accounts: PLAccount[];
  total_income: number;
  total_expenses: number;
  net_profit: number;
  period_start: string;
  period_end: string;
}

interface Entity {
  id: number;
  code: string;
  name: string | null;
}

export default function ProfitLossPage() {
  const { currentUser } = useAuth();
  const [plData, setPLData] = useState<PLData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState('current-month');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [selectedEntity, setSelectedEntity] = useState('');
  const [selectedCurrency, setSelectedCurrency] = useState('');
  const [entities, setEntities] = useState<Entity[]>([]);
  const [currencies, setCurrencies] = useState<string[]>([]);
  const [showUpdateBalancesModal, setShowUpdateBalancesModal] = useState(false);
  const [entityToUpdate, setEntityToUpdate] = useState('');
  const [isUpdatingBalances, setIsUpdatingBalances] = useState(false);

  const getCurrentMonthDates = () => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return {
      start: start.toISOString().split('T')[0],
      end: end.toISOString().split('T')[0]
    };
  };

  const getMonthDates = (monthsBack: number) => {
    const now = new Date();
    const targetMonth = new Date(now.getFullYear(), now.getMonth() - monthsBack, 1);
    const start = new Date(targetMonth.getFullYear(), targetMonth.getMonth(), 1);
    const end = new Date(targetMonth.getFullYear(), targetMonth.getMonth() + 1, 0);
    return {
      start: start.toISOString().split('T')[0],
      end: end.toISOString().split('T')[0]
    };
  };

  const getLastNMonthsDates = (months: number) => {
    const now = new Date();
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0); // Last day of current month
    const start = new Date(now.getFullYear(), now.getMonth() - months + 1, 1); // First day of N months ago
    return {
      start: start.toISOString().split('T')[0],
      end: end.toISOString().split('T')[0]
    };
  };

  const getCurrentYearDates = () => {
    const now = new Date();
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0); // Last day of current month
    const start = new Date(now.getFullYear(), 0, 1); // January 1st of current year
    return {
      start: start.toISOString().split('T')[0],
      end: end.toISOString().split('T')[0]
    };
  };

  const getPeriodDates = () => {
    switch (selectedPeriod) {
      case 'current-month':
        return getCurrentMonthDates();
      case 'last-month':
        return getMonthDates(1);
      case 'two-months-ago':
        return getMonthDates(2);
      case 'last-3-months':
        return getLastNMonthsDates(3);
      case 'last-6-months':
        return getLastNMonthsDates(6);
      case 'current-year':
        return getCurrentYearDates();
      case 'custom':
        return {
          start: customStartDate,
          end: customEndDate
        };
      default:
        return getCurrentMonthDates();
    }
  };

  const fetchEntitiesAndCurrencies = async () => {
    if (!currentUser) return;

    try {
      const token = await currentUser.getIdToken();

      // Fetch entities
      const entitiesResponse = await fetch('/api/entities', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (entitiesResponse.ok) {
        const entitiesData = await entitiesResponse.json();
        setEntities(entitiesData || []);
      }

      // Fetch available currencies from user's accounts
      const currenciesResponse = await fetch('/api/accounts/currencies', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (currenciesResponse.ok) {
        const currenciesData = await currenciesResponse.json();
        setCurrencies(currenciesData || []);
      }
    } catch (err) {
      console.error('Failed to fetch entities/currencies:', err);
    }
  };

  const fetchPLData = async () => {
    if (!currentUser) return;

    try {
      setLoading(true);
      setError(null);

      const { start, end } = getPeriodDates();

      // Skip fetching if in custom mode but dates aren't set yet
      if (selectedPeriod === 'custom' && (!start || !end)) {
        setLoading(false);
        return;
      }

      const token = await currentUser.getIdToken();

      // Build query parameters
      const params = new URLSearchParams({
        start_date: start,
        end_date: end
      });

      if (selectedEntity) {
        params.append('entity_id', selectedEntity);
      }

      if (selectedCurrency) {
        params.append('currency', selectedCurrency);
      }

      const response = await fetch(`/api/profit-loss?${params.toString()}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch profit & loss data');
      }

      const data = await response.json();

      console.log('Fetched P&L Data:', data);
      setPLData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (currentUser) {
      fetchEntitiesAndCurrencies();
    }
  }, [currentUser]);

  useEffect(() => {
    // Only auto-fetch for non-custom periods
    if (selectedPeriod !== 'custom') {
      fetchPLData();
    }
  }, [currentUser, selectedPeriod, selectedEntity, selectedCurrency]);

  const formatCurrency = (amount: number, currencyCode: string) => {
    try {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: currencyCode === 'ABNB' ? 'USD' : currencyCode,
      }).format(Math.abs(amount));
    } catch {
      return `${currencyCode} ${Math.abs(amount).toFixed(2)}`;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const getPeriodLabel = () => {
    if (!plData) return '';

    const startDate = formatDate(plData.period_start);
    const endDate = formatDate(plData.period_end);

    switch (selectedPeriod) {
      case 'current-month':
        return `Current Month (${startDate} - ${endDate})`;
      case 'last-month':
        return `Last Month (${startDate} - ${endDate})`;
      case 'two-months-ago':
        return `Two Months Ago (${startDate} - ${endDate})`;
      case 'last-3-months':
        return `Last 3 Months (${startDate} - ${endDate})`;
      case 'last-6-months':
        return `Last 6 Months (${startDate} - ${endDate})`;
      case 'current-year':
        return `Current Year (${startDate} - ${endDate})`;
      case 'custom':
        return `Custom Period (${startDate} - ${endDate})`;
      default:
        return `${startDate} - ${endDate}`;
    }
  };

  const handleUpdateBalances = async () => {
    if (!entityToUpdate || !currentUser) return;

    setIsUpdatingBalances(true);
    try {
      const token = await currentUser.getIdToken();

      const response = await fetch(`/api/entities/${entityToUpdate}/update-balances`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        alert(data.message || 'Account balances updated successfully!');
        setShowUpdateBalancesModal(false);
        setEntityToUpdate('');
        // Refresh P&L data if the updated entity is currently selected
        if (selectedEntity === entityToUpdate) {
          fetchPLData();
        }
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update balances');
      }
    } catch (error) {
      console.error('Failed to update balances:', error);
      alert(error instanceof Error ? error.message : 'Failed to update balances');
    } finally {
      setIsUpdatingBalances(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="p-6">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-1/3 mb-6"></div>
            <div className="h-10 bg-gray-200 rounded w-1/2 mb-6"></div>
            <div className="space-y-4">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="h-12 bg-gray-200 rounded"></div>
              ))}
            </div>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (error) {
    return (
      <DashboardLayout>
        <div className="p-6">
          <div className="bg-red-50 border border-red-200 rounded-md p-4">
            <div className="text-red-800">Error: {error}</div>
            <button
              onClick={() => fetchPLData()}
              className="mt-2 text-sm text-red-600 hover:text-red-800 underline"
            >
              Try again
            </button>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-6">
      {/* Header */}
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Profit & Loss Statement
          </h1>
          <p className="text-gray-600">
            {plData && getPeriodLabel()}
          </p>
        </div>
        <button
          onClick={() => setShowUpdateBalancesModal(true)}
          className="px-4 py-2 bg-green-600 text-white font-medium rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
        >
          Update Balances
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Filters & Time Period</h2>
        <div className="space-y-6">
          {/* Entity and Currency Filters */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Entity
              </label>
              <select
                value={selectedEntity}
                onChange={(e) => setSelectedEntity(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">All Entities</option>
                {entities.map((entity) => (
                  <option key={entity.id} value={entity.id.toString()}>
                    {entity.name || 'Unnamed Entity'} ({entity.code})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Currency
              </label>
              <select
                value={selectedCurrency}
                onChange={(e) => setSelectedCurrency(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">All Currencies</option>
                {currencies.map((currency) => (
                  <option key={currency} value={currency}>
                    {currency}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Time Period */}
          <div className="border-t border-gray-200 pt-6">
            <h3 className="text-md font-medium text-gray-900 mb-4">Time Period</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Period
                </label>
                <select
                  value={selectedPeriod}
                  onChange={(e) => setSelectedPeriod(e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="current-month">This Month</option>
                  <option value="last-month">Last Month</option>
                  <option value="two-months-ago">Two Months Ago</option>
                  <option value="last-3-months">Last 3 Months</option>
                  <option value="last-6-months">Last 6 Months</option>
                  <option value="current-year">Current Year</option>
                  <option value="custom">Custom Period</option>
                </select>
              </div>

          {selectedPeriod === 'custom' && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Start Date
                </label>
                <input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  End Date
                </label>
                <input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div className="flex items-end">
                <button
                  onClick={() => fetchPLData()}
                  disabled={!customStartDate || !customEndDate || loading}
                  className="w-full px-4 py-2 bg-indigo-600 text-white font-medium rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'Searching...' : 'Search'}
                </button>
              </div>
            </>
          )}
            </div>
          </div>
        </div>
      </div>

      {plData && (
        <div className="space-y-6">
          {/* Income Section */}
          <div className="bg-white rounded-lg shadow-sm border">
            <div className="px-6 py-4 border-b border-gray-200 bg-green-50">
              <h2 className="text-lg font-semibold text-green-800">Income</h2>
            </div>
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
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Amount
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {plData.income_accounts.map((account, index) => (
                    <tr key={`income-${index}`} className="hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">
                        {account.alias}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {account.code}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {account.category}
                      </td>
                      <td className="px-6 py-4 text-sm text-right font-medium text-green-600">
                        {formatCurrency(account.total_balance, account.currency)}
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-green-50 border-t-2 border-green-200">
                    <td colSpan={3} className="px-6 py-4 text-sm font-bold text-green-800">
                      Total Income
                    </td>
                    <td className="px-6 py-4 text-sm text-right font-bold text-green-800">
                      {formatCurrency(plData.total_income, plData.income_accounts[0]?.currency || 'USD')}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Expenses Section */}
          <div className="bg-white rounded-lg shadow-sm border">
            <div className="px-6 py-4 border-b border-gray-200 bg-red-50">
              <h2 className="text-lg font-semibold text-red-800">Expenses</h2>
            </div>
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
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Amount
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {plData.expense_accounts.map((account, index) => (
                    <tr key={`expense-${index}`} className="hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">
                        {account.alias}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {account.code}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {account.category}
                      </td>
                      <td className="px-6 py-4 text-sm text-right font-medium text-red-600">
                        {formatCurrency(account.total_balance, account.currency)}
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-red-50 border-t-2 border-red-200">
                    <td colSpan={3} className="px-6 py-4 text-sm font-bold text-red-800">
                      Total Expenses
                    </td>
                    <td className="px-6 py-4 text-sm text-right font-bold text-red-800">
                      {formatCurrency(plData.total_expenses, plData.expense_accounts[0]?.currency || 'USD')}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Net Profit/Loss Summary */}
          <div className={`rounded-lg shadow-sm border ${plData.net_profit >= 0 ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
            <div className="px-6 py-6">
              <div className="flex justify-between items-center">
                <div>
                  <h2 className={`text-xl font-bold ${plData.net_profit >= 0 ? 'text-green-800' : 'text-red-800'}`}>
                    {plData.net_profit >= 0 ? 'Net Profit' : 'Net Loss'}
                  </h2>
                  <p className="text-sm text-gray-600">
                    Total Income - Total Expenses
                  </p>
                </div>
                <div className={`text-3xl font-bold ${plData.net_profit >= 0 ? 'text-green-800' : 'text-red-800'}`}>
                  {formatCurrency(plData.net_profit, plData.income_accounts[0]?.currency || plData.expense_accounts[0]?.currency || 'USD')}
                </div>
              </div>

              <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div className="bg-white rounded p-3 border">
                  <div className="text-gray-500">Total Income</div>
                  <div className="text-lg font-semibold text-green-600">
                    {formatCurrency(plData.total_income, plData.income_accounts[0]?.currency || 'USD')}
                  </div>
                </div>
                <div className="bg-white rounded p-3 border">
                  <div className="text-gray-500">Total Expenses</div>
                  <div className="text-lg font-semibold text-red-600">
                    {formatCurrency(plData.total_expenses || 0, plData.expense_accounts[0]?.currency || 'USD')}
                  </div>
                </div>
                <div className="bg-white rounded p-3 border">
                  <div className="text-gray-500">Profit Margin</div>
                  <div className={`text-lg font-semibold ${plData.net_profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {plData.total_income > 0 ? ((plData.net_profit / plData.total_income) * 100).toFixed(1) : '0.0'}%
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {plData && plData.income_accounts.length === 0 && plData.expense_accounts.length === 0 && (
        <div className="bg-white rounded-lg shadow-sm border p-6 text-center text-gray-500">
          No income or expense transactions found for the selected period.
        </div>
      )}

      {/* Update Balances Modal */}
      {showUpdateBalancesModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Update Account Balances</h2>
            <p className="text-sm text-gray-600 mb-4">
              This will recalculate all account balances for the selected entity based on their transactions.
            </p>

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Entity
              </label>
              <select
                value={entityToUpdate}
                onChange={(e) => setEntityToUpdate(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
              >
                <option value="">Choose an entity...</option>
                {entities.map((entity) => (
                  <option key={entity.id} value={entity.id.toString()}>
                    {entity.name || 'Unnamed Entity'} ({entity.code})
                  </option>
                ))}
              </select>
            </div>

            <div className="flex space-x-3">
              <button
                onClick={() => {
                  setShowUpdateBalancesModal(false);
                  setEntityToUpdate('');
                }}
                disabled={isUpdatingBalances}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 font-medium rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleUpdateBalances}
                disabled={!entityToUpdate || isUpdatingBalances}
                className="flex-1 px-4 py-2 bg-green-600 text-white font-medium rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isUpdatingBalances ? 'Updating...' : 'Update Balances'}
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    </DashboardLayout>
  );
}