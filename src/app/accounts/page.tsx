'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useAccountsData } from '@/hooks/useAccountsData';
import DashboardLayout from '@/components/DashboardLayout';
import TransactionsModal from '@/components/TransactionsModal';
import ReconcileModal from '@/components/ReconcileModal';
import StatementImportModal from '@/components/StatementImportModal';
import TransactionAssignmentModal from '@/components/TransactionAssignmentModal';
import { MagnifyingGlassIcon, ArrowPathIcon, EllipsisVerticalIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import { Account, Transaction } from '@/lib/database';

export default function AccountsPage() {
  const router = useRouter();
  const { currentUser } = useAuth();
  const { accounts, loading, error, refetch } = useAccountsData();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterCurrency, setFilterCurrency] = useState('');
  const [openActionMenus, setOpenActionMenus] = useState<Set<number>>(new Set());
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);
  const [isTransactionsModalOpen, setIsTransactionsModalOpen] = useState(false);
  const [isReconcileModalOpen, setIsReconcileModalOpen] = useState(false);
  const [isStatementImportModalOpen, setIsStatementImportModalOpen] = useState(false);
  const [isAssignmentModalOpen, setIsAssignmentModalOpen] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [incompleteTransactions, setIncompleteTransactions] = useState<Transaction[]>([]);

  const toggleActionMenu = (accountId: number) => {
    const newOpenMenus = new Set(openActionMenus);
    if (newOpenMenus.has(accountId)) {
      newOpenMenus.delete(accountId);
    } else {
      newOpenMenus.add(accountId);
    }
    setOpenActionMenus(newOpenMenus);
  };

  const handleRowClick = (accountId: number, event: React.MouseEvent) => {
    // Don't navigate if clicking on the actions button or menu
    const target = event.target as HTMLElement;
    if (target.closest('[data-action-menu]')) {
      return;
    }
    router.push(`/accounts/${accountId}`);
  };

  const handleAction = (accountId: number, action: string) => {
    // Close the menu
    const newOpenMenus = new Set(openActionMenus);
    newOpenMenus.delete(accountId);
    setOpenActionMenus(newOpenMenus);

    // Find the account
    const account = filteredAccounts.find(acc => acc.id === accountId);

    // Handle the action
    switch (action) {
      case 'view':
        console.log(`View details for account ${accountId}`);
        // TODO: Implement view details
        break;
      case 'edit':
        console.log(`Edit account ${accountId}`);
        // TODO: Implement edit account
        break;
      case 'transactions':
        if (account) {
          setSelectedAccount(account);
          setIsTransactionsModalOpen(true);
        }
        break;
      case 'reconcile':
        if (account) {
          setSelectedAccount(account);
          setIsReconcileModalOpen(true);
        }
        break;
      case 'import-statement':
        if (account) {
          setSelectedAccount(account);
          setIsStatementImportModalOpen(true);
        }
        break;
      case 'assign-transactions':
        handleAssignTransactions(accountId);
        break;
      case 'statements':
        console.log(`Download statements for account ${accountId}`);
        // TODO: Implement download statements
        break;
      case 'deactivate':
        console.log(`Deactivate account ${accountId}`);
        // TODO: Implement deactivate account
        break;
      default:
        console.log(`Unknown action "${action}" for account ${accountId}`);
    }
  };

  const handleReconciliationComplete = () => {
    // Refresh the accounts data to show updated balance
    refetch();
  };

  const handleStatementImportComplete = () => {
    // Refresh the accounts data to show updated balance
    refetch();
  };


  const handleAssignTransactions = async (accountId: number) => {
    // Close the menu
    const newOpenMenus = new Set(openActionMenus);
    newOpenMenus.delete(accountId);
    setOpenActionMenus(newOpenMenus);

    // Find the account
    const account = filteredAccounts.find(acc => acc.id === accountId);
    if (!account) return;

    try {
      const response = await fetch(`/api/incomplete-transactions/${account.code}?limit=20`);
      const data = await response.json();

      if (response.ok) {
        setSelectedAccount(account);
        setIsAssignmentModalOpen(true);
      }
    } catch (error) {
      console.error('Failed to load incomplete transactions:', error);
    }
  };

  const handleAssignmentComplete = () => {
    // Refresh the accounts data (includes updated incomplete counts)
    refetch();

    // Close modal and clear state
    setIsAssignmentModalOpen(false);
    setSelectedTransaction(null);
  };


  // Close action menus when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('[data-action-menu]')) {
        setOpenActionMenus(new Set());
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Filter accounts based on search term, category, and currency, only show active accounts
  const filteredAccounts = accounts.filter(account => {
    // Only show active accounts (inactive = deleted)
    const isActive = account.active === 1;

    const matchesSearch = searchTerm === '' ||
      account.alias.toLowerCase().includes(searchTerm.toLowerCase()) ||
      account.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      account.numero.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesCategory = filterCategory === '' || account.category === filterCategory;
    const matchesCurrency = filterCurrency === '' || account.currency === filterCurrency;

    return isActive && matchesSearch && matchesCategory && matchesCurrency;
  });

  // Get unique categories and currencies for filter dropdowns (only from active accounts)
  const activeAccounts = accounts.filter(account => account.active === 1);
  const categories = [...new Set(activeAccounts.map(account => account.category).filter((cat): cat is string => Boolean(cat)))];
  const currencies = [...new Set(activeAccounts.map(account => account.currency).filter((cur): cur is string => Boolean(cur)))].sort();

  const formatCurrency = (amount: number, currency: string) => {
    // List of valid ISO currency codes
    const validCurrencies = new Set([
      'USD', 'EUR', 'GBP', 'JPY', 'AUD', 'CAD', 'CHF', 'CNY', 'SEK', 'NZD',
      'MXN', 'SGD', 'HKD', 'NOK', 'TRY', 'ZAR', 'BRL', 'INR', 'KRW', 'RUB',
      'PLN', 'THB', 'TWD', 'DKK', 'CZK', 'HUF', 'ILS', 'CLP', 'PHP', 'AED',
      'COP', 'SAR', 'MYR', 'RON', 'BGN', 'HRK', 'ISK', 'QAR', 'KWD', 'BHD'
    ]);

    const currencyCode = currency?.toUpperCase() || 'USD';

    try {
      if (validCurrencies.has(currencyCode)) {
        // Valid currency code - format as currency
        return new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: currencyCode
        }).format(amount);
      } else {
        // Invalid currency code (likely a stock symbol) - format as number with symbol
        return new Intl.NumberFormat('en-US', {
          style: 'decimal',
          minimumFractionDigits: 2,
          maximumFractionDigits: 2
        }).format(amount) + ' ' + currency;
      }
    } catch (error) {
      // Fallback formatting if anything goes wrong
      return `${amount.toFixed(2)} ${currency || ''}`;
    }
  };

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto">
        <div className="bg-white rounded-lg shadow">
          {/* Header */}
          <div className="border-b border-gray-200 p-6">
            <div className="flex justify-between items-center">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Accounts</h1>
                <p className="text-gray-600 mt-1">
                  {activeAccounts.length} active account{activeAccounts.length !== 1 ? 's' : ''} found
                </p>
              </div>
              <button
                onClick={refetch}
                className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                <ArrowPathIcon className="h-4 w-4 mr-2" />
                Refresh
              </button>
            </div>
          </div>

          {/* Filters */}
          <div className="p-6 border-b border-gray-200 bg-gray-50">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Search */}
              <div className="flex flex-col">
                <label htmlFor="search-input" className="text-sm font-medium text-gray-700 mb-1">
                  Search
                </label>
                <div className="relative">
                  <MagnifyingGlassIcon className="h-5 w-5 absolute left-3 top-3 text-gray-400" />
                  <input
                    id="search-input"
                    type="text"
                    placeholder="Search accounts..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 pr-3 py-2 border border-gray-300 rounded-md w-full focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
              </div>

              {/* Category Filter */}
              <div className="flex flex-col">
                <label htmlFor="category-filter" className="text-sm font-medium text-gray-700 mb-1">
                  Category
                </label>
                <select
                  id="category-filter"
                  value={filterCategory}
                  onChange={(e) => setFilterCategory(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                >
                  <option value="">All Categories</option>
                  {categories.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </div>

              {/* Currency Filter */}
              <div className="flex flex-col">
                <label htmlFor="currency-filter" className="text-sm font-medium text-gray-700 mb-1">
                  Currency
                </label>
                <select
                  id="currency-filter"
                  value={filterCurrency}
                  onChange={(e) => setFilterCurrency(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
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
          </div>

          {/* Content */}
          <div className="p-6 overflow-visible">
            {loading && (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
                <span className="ml-3 text-gray-600">Loading accounts...</span>
              </div>
            )}

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-md mb-6">
                Error: {error}
              </div>
            )}


            {!loading && !error && filteredAccounts.length === 0 && accounts.length === 0 && (
              <div className="text-center py-12">
                <div className="text-gray-400 text-6xl mb-4">📊</div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">No accounts found</h3>
                <p className="text-gray-500">You don&apos;t have any accounts associated with your profile yet.</p>
              </div>
            )}

            {!loading && !error && filteredAccounts.length === 0 && accounts.length > 0 && (
              <div className="text-center py-12">
                <div className="text-gray-400 text-6xl mb-4">🔍</div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">No matching accounts</h3>
                <p className="text-gray-500">Try adjusting your search or filter criteria.</p>
              </div>
            )}

            {!loading && !error && filteredAccounts.length > 0 && (
              <div className="overflow-x-auto" style={{ overflowY: 'visible' }}>
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Account
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Code / Number
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
                    {filteredAccounts.map((account) => (
                      <tr
                        key={account.id}
                        className="hover:bg-gray-50 cursor-pointer"
                        onClick={(e) => handleRowClick(account.id, e)}
                      >
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div>
                            <div className="text-sm font-medium text-gray-900">
                              {account.alias}
                            </div>
                            {account.client && (
                              <div className="text-sm text-gray-500">Client: {account.client}</div>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">{account.code}</div>
                          <div className="text-sm text-gray-500">{account.numero}</div>
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
                          <div className="text-xs text-gray-500 flex items-center">
                            {account.currency}
                            {(account.incomplete_transactions_count || 0) > 0 && (
                              <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                                <ExclamationTriangleIcon className="h-3 w-3 mr-1" />
                                {account.incomplete_transactions_count} incomplete
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <div className="relative" data-action-menu>
                            <button
                              onClick={() => toggleActionMenu(account.id)}
                              className="inline-flex items-center p-2 text-gray-400 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 rounded-full"
                            >
                              <EllipsisVerticalIcon className="h-5 w-5" />
                            </button>

                            {openActionMenus.has(account.id) && (
                              <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-md shadow-lg z-50 ring-1 ring-black ring-opacity-5 transform -translate-x-0">
                                <div className="py-1">
                                  <button
                                    onClick={() => handleAction(account.id, 'view')}
                                    className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                                  >
                                    View Details
                                  </button>
                                  <button
                                    onClick={() => handleAction(account.id, 'edit')}
                                    className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                                  >
                                    Edit Account
                                  </button>
                                  <button
                                    onClick={() => handleAction(account.id, 'transactions')}
                                    className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                                  >
                                    View Transactions
                                  </button>
                                  <button
                                    onClick={() => handleAction(account.id, 'reconcile')}
                                    className="block w-full text-left px-4 py-2 text-sm text-indigo-600 hover:bg-indigo-50"
                                  >
                                    Reconcile Account
                                  </button>
                                  <button
                                    onClick={() => handleAction(account.id, 'import-statement')}
                                    className="block w-full text-left px-4 py-2 text-sm text-green-600 hover:bg-green-50"
                                  >
                                    Import Statement
                                  </button>
                                  {(account.incomplete_transactions_count || 0) > 0 && (
                                    <button
                                      onClick={() => handleAction(account.id, 'assign-transactions')}
                                      className="block w-full text-left px-4 py-2 text-sm text-yellow-600 hover:bg-yellow-50 flex items-center"
                                    >
                                      <ExclamationTriangleIcon className="h-4 w-4 mr-2" />
                                      Assign Transactions ({account.incomplete_transactions_count})
                                    </button>
                                  )}
                                  <button
                                    onClick={() => handleAction(account.id, 'statements')}
                                    className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                                  >
                                    Download Statement
                                  </button>
                                  <div className="border-t border-gray-100">
                                    <button
                                      onClick={() => handleAction(account.id, 'deactivate')}
                                      className="block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                                    >
                                      Deactivate Account
                                    </button>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Transactions Modal */}
        <TransactionsModal
          isOpen={isTransactionsModalOpen}
          onClose={() => {
            setIsTransactionsModalOpen(false);
            setSelectedAccount(null);
          }}
          account={selectedAccount}
        />

        {/* Reconcile Modal */}
        <ReconcileModal
          isOpen={isReconcileModalOpen}
          onClose={() => {
            setIsReconcileModalOpen(false);
            setSelectedAccount(null);
          }}
          account={selectedAccount}
          onReconciliationComplete={handleReconciliationComplete}
        />

        {/* Statement Import Modal */}
        <StatementImportModal
          isOpen={isStatementImportModalOpen}
          onClose={() => {
            setIsStatementImportModalOpen(false);
            setSelectedAccount(null);
          }}
          account={selectedAccount}
          onImportComplete={handleStatementImportComplete}
        />

        {/* Transaction Assignment Modal */}
        <TransactionAssignmentModal
          isOpen={isAssignmentModalOpen}
          onClose={() => {
            setIsAssignmentModalOpen(false);
            setSelectedAccount(null);
          }}
          transaction={null}
          onAssignmentComplete={handleAssignmentComplete}
          accountCode={selectedAccount?.code}
        />
      </div>
    </DashboardLayout>
  );
}