'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeftIcon, ArrowUpTrayIcon } from '@heroicons/react/24/outline';
import { useAuth } from '@/contexts/AuthContext';
import { Account } from '@/lib/database';
import StatementImportModal from '@/components/StatementImportModal';

interface AccountDetails {
  account_id: number;
  account_code: string;
  account_name: string;
  account_type: string;
  currency_code: string;
  current_balance: number;
  account_status: string;
  created_at: string;
  updated_at: string;
  category?: string;
}

interface Transaction {
  id: number;
  fecha: string;
  description: string;
  debit: number;
  credit: number;
  debitacc: string;
  creditacc: string;
  transaction_type: 'debit' | 'credit';
  other_account_code: string;
  other_account_alias: string;
  other_account_type: string;
  classification: 'income' | 'expense' | 'transfer';
  entity_id?: number | null;
  entity_name?: string;
  entity_code?: string;
}

interface Entity {
  id: number;
  code: string;
  name: string | null;
}

const EntitySelector = ({
  currentEntityId,
  currentEntityName,
  transactionId,
  entities,
  onEntityAssign,
  isAssigning
}: {
  currentEntityId?: number | null;
  currentEntityName?: string;
  transactionId: number;
  entities: Entity[];
  onEntityAssign: (transactionId: number, entityId: number) => void;
  isAssigning: boolean;
}) => {
  const [isOpen, setIsOpen] = useState(false);

  if (currentEntityId && currentEntityName) {
    // Show current entity with option to change
    return (
      <div className="relative">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center text-sm text-gray-700 hover:text-gray-900 focus:outline-none"
          disabled={isAssigning}
        >
          <div>
            <div className="font-medium">{currentEntityName}</div>
            <div className="text-xs text-gray-400">Click to change</div>
          </div>
        </button>

        {isAssigning && (
          <div className="absolute inset-0 bg-blue-50 bg-opacity-75 flex items-center justify-center rounded">
            <div className="flex items-center text-xs text-blue-600">
              <div className="animate-spin h-3 w-3 border border-blue-500 border-t-transparent rounded-full mr-1"></div>
              Updating...
            </div>
          </div>
        )}

        {isOpen && (
          <div className="absolute z-50 mt-1 w-48 bg-white border border-gray-300 rounded-md shadow-lg">
            <div className="py-1 max-h-48 overflow-y-auto">
              <button
                onClick={() => {
                  // TODO: Handle remove entity
                  setIsOpen(false);
                }}
                className="block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50"
              >
                Remove Entity
              </button>
              <div className="border-t border-gray-100"></div>
              {entities.map((entity) => (
                <button
                  key={entity.id}
                  onClick={() => {
                    onEntityAssign(transactionId, entity.id);
                    setIsOpen(false);
                  }}
                  className={`block w-full text-left px-4 py-2 text-sm hover:bg-gray-50 ${
                    entity.id === currentEntityId ? 'bg-indigo-50 text-indigo-700' : 'text-gray-700'
                  }`}
                >
                  <div className="font-medium">{entity.name || 'Unnamed Entity'}</div>
                  <div className="text-xs text-gray-500">{entity.code}</div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // Show dropdown to assign entity
  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="text-sm text-gray-400 hover:text-gray-600 focus:outline-none"
        disabled={isAssigning}
      >
        {isAssigning ? (
          <div className="flex items-center">
            <div className="animate-spin h-3 w-3 border border-blue-500 border-t-transparent rounded-full mr-1"></div>
            Assigning...
          </div>
        ) : (
          'Assign Entity'
        )}
      </button>

      {isOpen && (
        <div className="absolute z-50 mt-1 w-48 bg-white border border-gray-300 rounded-md shadow-lg">
          <div className="py-1 max-h-48 overflow-y-auto">
            {entities.length === 0 ? (
              <div className="px-4 py-2 text-sm text-gray-500">No entities available</div>
            ) : (
              entities.map((entity) => (
                <button
                  key={entity.id}
                  onClick={() => {
                    onEntityAssign(transactionId, entity.id);
                    setIsOpen(false);
                  }}
                  className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                >
                  <div className="font-medium">{entity.name || 'Unnamed Entity'}</div>
                  <div className="text-xs text-gray-500">{entity.code}</div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default function AccountDetailPage() {
  const params = useParams();
  const accountId = params.id as string;
  const { currentUser } = useAuth();

  const [account, setAccount] = useState<AccountDetails | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeAccounts, setActiveAccounts] = useState<Account[]>([]);
  const [entities, setEntities] = useState<Entity[]>([]);
  const [assigningTransaction, setAssigningTransaction] = useState<number | null>(null);
  const [assigningEntity, setAssigningEntity] = useState<number | null>(null);
  const [selectedTransactions, setSelectedTransactions] = useState<Set<number>>(new Set());
  const [bulkAssignAccount, setBulkAssignAccount] = useState('');
  const [bulkAssignType, setBulkAssignType] = useState<'debit' | 'credit'>('debit');
  const [bulkAssignEntity, setBulkAssignEntity] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [accountFilter, setAccountFilter] = useState<'all' | 'empty' | 'filled'>('all');
  const [isEditingAccount, setIsEditingAccount] = useState(false);
  const [editedAccount, setEditedAccount] = useState<Partial<AccountDetails>>({});
  const [isSavingAccount, setIsSavingAccount] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

  // Multi-select functions for transactions
  const toggleTransactionSelection = (transactionId: number) => {
    const newSelection = new Set(selectedTransactions);
    if (newSelection.has(transactionId)) {
      newSelection.delete(transactionId);
    } else {
      newSelection.add(transactionId);
    }
    setSelectedTransactions(newSelection);
  };

  const selectAllTransactions = () => {
    setSelectedTransactions(new Set(filteredTransactions.map(transaction => transaction.id)));
  };

  const clearTransactionSelection = () => {
    setSelectedTransactions(new Set());
  };

  // Filter transactions based on search term and account filter
  const filteredTransactions = transactions.filter(transaction => {
    // Apply search term filter
    if (searchTerm.trim()) {
      const searchLower = searchTerm.toLowerCase();
      const matchesSearch = (
        transaction.description?.toLowerCase().includes(searchLower) ||
        transaction.debitacc?.toLowerCase().includes(searchLower) ||
        transaction.creditacc?.toLowerCase().includes(searchLower) ||
        transaction.debit?.toString().includes(searchLower) ||
        transaction.credit?.toString().includes(searchLower) ||
        transaction.other_account_alias?.toLowerCase().includes(searchLower) ||
        transaction.other_account_code?.toLowerCase().includes(searchLower)
      );
      if (!matchesSearch) return false;
    }

    // Apply account filter
    if (accountFilter === 'empty') {
      return transaction.debitacc === '0' || transaction.creditacc === '0';
    } else if (accountFilter === 'filled') {
      return transaction.debitacc !== '0' && transaction.creditacc !== '0';
    }

    return true;
  });

  const isAllTransactionsSelected = filteredTransactions.length > 0 && selectedTransactions.size === filteredTransactions.length;
  const isPartiallyTransactionsSelected = selectedTransactions.size > 0 && selectedTransactions.size < filteredTransactions.length;

  // Bulk account assignment function for transactions
  const handleBulkAccountAssignment = async () => {
    if (!bulkAssignAccount || selectedTransactions.size === 0) return;

    try {
      const transactionIds = Array.from(selectedTransactions);

      // Get Firebase ID token for authentication
      const token = currentUser ? await currentUser.getIdToken() : null;

      const response = await fetch('/api/transactions/bulk-assign', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { Authorization: `Bearer ${token}` }),
        },
        body: JSON.stringify({
          transactionIds,
          assignedAccountCode: bulkAssignAccount,
          isDebitAccount: bulkAssignType === 'debit',
        }),
      });

      if (response.ok) {
        // Refresh transactions data
        fetchAccountDetails();
        // Clear selection
        clearTransactionSelection();
        setBulkAssignAccount('');
        // Show success message
        alert(`Successfully assigned ${transactionIds.length} transaction${transactionIds.length !== 1 ? 's' : ''}`);
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to assign accounts');
      }
    } catch (error) {
      console.error('Failed to assign accounts:', error);
      alert(error instanceof Error ? error.message : 'Failed to assign accounts');
    }
  };

  // Bulk entity assignment function for transactions
  const handleBulkEntityAssignment = async () => {
    if (!bulkAssignEntity || selectedTransactions.size === 0) return;

    try {
      const transactionIds = Array.from(selectedTransactions);

      // Get Firebase ID token for authentication
      const token = currentUser ? await currentUser.getIdToken() : null;

      const response = await fetch('/api/transactions/bulk-assign-entity', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { Authorization: `Bearer ${token}` }),
        },
        body: JSON.stringify({
          transactionIds,
          entityId: parseInt(bulkAssignEntity),
        }),
      });

      if (response.ok) {
        // Refresh transactions data
        fetchAccountDetails();
        // Clear selection
        clearTransactionSelection();
        setBulkAssignEntity('');
        // Show success message
        alert(`Successfully assigned entity to ${transactionIds.length} transaction${transactionIds.length !== 1 ? 's' : ''}`);
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to assign entity');
      }
    } catch (error) {
      console.error('Failed to assign entity:', error);
      alert(error instanceof Error ? error.message : 'Failed to assign entity');
    }
  };

  // Edit account handler
  const handleEditAccount = () => {
    setIsEditingAccount(true);
    setEditedAccount({
      account_name: account?.account_name,
      category: account?.category,
      account_type: account?.account_type,
      account_status: account?.account_status,
      currency_code: account?.currency_code,
    });
  };

  const handleCancelEdit = () => {
    setIsEditingAccount(false);
    setEditedAccount({});
  };

  const handleSaveAccount = async () => {
    if (!account || !currentUser) return;

    setIsSavingAccount(true);

    try {
      const token = await currentUser.getIdToken();

      const response = await fetch(`/api/accounts/${accountId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(editedAccount),
      });

      if (response.ok) {
        // Refresh account data
        await fetchAccountDetails();
        setIsEditingAccount(false);
        setEditedAccount({});
        alert('Account updated successfully');
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update account');
      }
    } catch (error) {
      console.error('Failed to update account:', error);
      alert(error instanceof Error ? error.message : 'Failed to update account');
    } finally {
      setIsSavingAccount(false);
    }
  };

  // Bulk delete transactions function
  const handleBulkDeleteTransactions = async () => {
    if (selectedTransactions.size === 0) return;

    const count = selectedTransactions.size;
    const confirmed = confirm(
      `Are you sure you want to delete ${count} transaction${count !== 1 ? 's' : ''}?\n\nThis action cannot be undone.`
    );

    if (!confirmed) return;

    try {
      const transactionIds = Array.from(selectedTransactions);

      // Get Firebase ID token for authentication
      const token = currentUser ? await currentUser.getIdToken() : null;

      const response = await fetch('/api/transactions/bulk-delete', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { Authorization: `Bearer ${token}` }),
        },
        body: JSON.stringify({
          transactionIds,
        }),
      });

      if (response.ok) {
        // Refresh transactions data
        fetchAccountDetails();
        // Clear selection
        clearTransactionSelection();
        // Show success message
        alert(`Successfully deleted ${count} transaction${count !== 1 ? 's' : ''}`);
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete transactions');
      }
    } catch (error) {
      console.error('Failed to delete transactions:', error);
      alert(error instanceof Error ? error.message : 'Failed to delete transactions');
    }
  };

  const fetchAccountDetails = async () => {
    try {
        setLoading(true);

        // Fetch account details
        const accountResponse = await fetch(`/api/accounts/${accountId}`);
        if (!accountResponse.ok) {
          throw new Error('Failed to fetch account details');
        }
        const accountData = await accountResponse.json();
        setAccount(accountData);

        // Fetch account transactions
        const transactionsResponse = await fetch(`/api/transactions/${accountId}`);
        if (!transactionsResponse.ok) {
          throw new Error('Failed to fetch transactions');
        }
        const transactionsData = await transactionsResponse.json();
        setTransactions(transactionsData || []);

        // Fetch active accounts and entities for autocomplete
        if (currentUser) {
          const token = await currentUser.getIdToken();

          // Fetch accounts
          const accountsResponse = await fetch('/api/accounts/me', {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
          });
          if (accountsResponse.ok) {
            const accountsData = await accountsResponse.json();
            setActiveAccounts(accountsData || []);
          }

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
        }

      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
  };

  useEffect(() => {
    if (accountId) {
      fetchAccountDetails();
    }
  }, [accountId]);

  const handleAccountAssignment = async (transactionId: number, accountCode: string, field: 'debit' | 'credit') => {
    try {
      console.log('Setting assigningTransaction to:', transactionId);
      setAssigningTransaction(transactionId);

      console.log('Assignment params:', { transactionId, accountCode, field, isDebitAccount: field === 'debit' });

      const token = localStorage.getItem('token');
      const requestBody = {
        transactionId,
        assignedAccountCode: accountCode,
        isDebitAccount: field === 'debit'
      };

      console.log('Sending request body:', JSON.stringify(requestBody));

      const response = await fetch('/api/assign-account', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { Authorization: `Bearer ${token}` }),
        },
        body: JSON.stringify(requestBody),
      });

      if (response.ok) {
        // Refresh transactions to show updated data
        const transactionsResponse = await fetch(`/api/transactions/${accountId}`);
        if (transactionsResponse.ok) {
          const transactionsData = await transactionsResponse.json();
          setTransactions(transactionsData || []);
        }
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to assign account');
      }
    } catch (err) {
      console.error('Failed to assign account:', err);
      alert(err instanceof Error ? err.message : 'Failed to assign account');
    } finally {
      // Add a small delay to show the loading state
      setTimeout(() => {
        console.log('Clearing assigningTransaction');
        setAssigningTransaction(null);
      }, 500);
    }
  };

  const handleEntityAssignment = async (transactionId: number, entityId: number) => {
    try {
      console.log('Setting assigningEntity to:', transactionId);
      setAssigningEntity(transactionId);

      const token = currentUser ? await currentUser.getIdToken() : null;
      const requestBody = {
        transactionId,
        entityId
      };

      console.log('Sending entity assignment request:', JSON.stringify(requestBody));

      const response = await fetch('/api/transactions/assign-entity', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { Authorization: `Bearer ${token}` }),
        },
        body: JSON.stringify(requestBody),
      });

      if (response.ok) {
        // Refresh transactions to show updated data
        fetchAccountDetails();
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to assign entity');
      }
    } catch (err) {
      console.error('Failed to assign entity:', err);
      alert(err instanceof Error ? err.message : 'Failed to assign entity');
    } finally {
      // Add a small delay to show the loading state
      setTimeout(() => {
        console.log('Clearing assigningEntity');
        setAssigningEntity(null);
      }, 500);
    }
  };

  const formatCurrency = (amount: number, currencyCode: string) => {
    try {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: currencyCode === 'ABNB' ? 'USD' : currencyCode,
      }).format(amount);
    } catch {
      return `${currencyCode} ${amount.toFixed(2)}`;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const AccountAutocomplete = ({
    currentValue,
    transactionId,
    field,
    isIncomplete,
    transaction
  }: {
    currentValue: string;
    transactionId: number;
    field: 'debit' | 'credit';
    isIncomplete: boolean;
    transaction: Transaction;
  }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [typeFilter, setTypeFilter] = useState<string>('');
    const [showCreateForm, setShowCreateForm] = useState(false);
    const [newAccountData, setNewAccountData] = useState({
      code: '',
      alias: '',
      category: ''
    });
    const dropdownRef = useRef<HTMLDivElement>(null);
    const isSelectingRef = useRef(false);

    if (!isIncomplete) {
      // Show read-only for complete transactions with alias from transaction data
      let aliasToShow = '';
      if (field === 'debit' && transaction.transaction_type === 'credit' && transaction.other_account_alias) {
        aliasToShow = transaction.other_account_alias;
      } else if (field === 'credit' && transaction.transaction_type === 'debit' && transaction.other_account_alias) {
        aliasToShow = transaction.other_account_alias;
      } else if (Array.isArray(activeAccounts)) {
        const accountInfo = activeAccounts.find(acc => acc.code === currentValue);
        aliasToShow = accountInfo?.alias || '';
      }

      return (
        <div className="relative">
          <div className="font-medium">{currentValue || '-'}</div>
          {aliasToShow && (
            <div className="text-xs text-gray-400">{aliasToShow}</div>
          )}
          {/* Loading overlay for complete transactions */}
          {assigningTransaction === transactionId && (
            <div className="absolute inset-0 bg-blue-50 bg-opacity-75 flex items-center justify-center rounded">
              <div className="flex items-center text-xs text-blue-600">
                <div className="animate-spin h-3 w-3 border border-blue-500 border-t-transparent rounded-full mr-1"></div>
                Assigning...
              </div>
            </div>
          )}
        </div>
      );
    }

    const filteredAccounts = Array.isArray(activeAccounts) ?
      activeAccounts.filter(accountItem => {
        // Filter by search term
        const matchesSearch = !searchTerm.trim() ||
          accountItem.alias.toLowerCase().includes(searchTerm.toLowerCase()) ||
          accountItem.code.toLowerCase().includes(searchTerm.toLowerCase());

        // Filter by account type
        const matchesType = !typeFilter || accountItem.category === typeFilter;

        // Filter by currency - only show accounts with same currency as current account
        const matchesCurrency = !account?.currency_code || accountItem.currency === account.currency_code;

        return matchesSearch && matchesType && matchesCurrency;
      }) : [];

    // Get unique account types for filter
    const accountTypes = Array.isArray(activeAccounts) ?
      [...new Set(activeAccounts.map(account => account.category).filter((cat): cat is string => Boolean(cat)))].sort() : [];

    const generateAccountCode = (category: string) => {
      if (!category) return '';

      // Category prefixes
      const prefixes = {
        asset: 'AST',
        liability: 'LIA',
        equity: 'EQU',
        income: 'INC',
        expense: 'EXP'
      };

      const prefix = prefixes[category as keyof typeof prefixes] || 'ACC';

      // Get existing codes with this prefix
      const existingCodes = Array.isArray(activeAccounts) ?
        activeAccounts
          .map(account => account.code)
          .filter(code => code.startsWith(prefix))
          .map(code => {
            const num = parseInt(code.substring(prefix.length));
            return isNaN(num) ? 0 : num;
          })
          .sort((a, b) => b - a) : [];

      // Find next available number
      const nextNumber = existingCodes.length > 0 ? existingCodes[0] + 1 : 1;

      // Format with leading zeros (3 digits)
      return `${prefix}${nextNumber.toString().padStart(3, '0')}`;
    };

    const handleCreateAccount = async () => {
      try {
        if (!newAccountData.code || !newAccountData.alias || !newAccountData.category) {
          alert('Please fill in all fields');
          return;
        }

        if (currentUser) {
          const token = await currentUser.getIdToken();
          const response = await fetch('/api/accounts', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              code: newAccountData.code,
              alias: newAccountData.alias,
              category: newAccountData.category,
              currency: account?.currency_code || 'USD',
              balance: 0,
              active: 1
            }),
          });

          if (response.ok) {
            // Assign the newly created account to the transaction
            await handleAccountAssignment(transactionId, newAccountData.code, field);

            // Reset form and close
            setNewAccountData({ code: '', alias: '', category: '' });
            setShowCreateForm(false);
            setIsOpen(false);
            setSearchTerm('');
            setTypeFilter('');
          } else {
            const errorData = await response.json();
            alert(errorData.error || 'Failed to create account');
          }
        }
      } catch (error) {
        console.error('Failed to create account:', error);
        alert('Failed to create account');
      }
    };

    return (
      <div className="relative">
        {/* Loading overlay for the entire component */}
        {assigningTransaction === transactionId && (
          <div className="absolute inset-0 bg-blue-50 bg-opacity-75 flex items-center justify-center rounded z-50">
            <div className="flex items-center text-xs text-blue-600">
              <div className="animate-spin h-3 w-3 border border-blue-500 border-t-transparent rounded-full mr-1"></div>
              Assigning...
            </div>
          </div>
        )}
        <div className="flex items-center">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setIsOpen(true);
            }}
            onFocus={() => {
              setIsOpen(true);
              // Show all accounts when first focused if no search term
              if (!searchTerm) {
                setSearchTerm('');
              }
            }}
            onBlur={() => {
              setTimeout(() => {
                if (!isSelectingRef.current) {
                  setIsOpen(false);
                }
                isSelectingRef.current = false;
              }, 150);
            }}
            placeholder="Select account..."
            className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500"
            disabled={assigningTransaction === transactionId}
          />
        </div>

        {isOpen && (
          <div
            ref={dropdownRef}
            className="absolute z-50 w-64 mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 flex flex-col"
            onMouseDown={() => {
              isSelectingRef.current = true;
            }}
            onMouseUp={() => {
              // Keep dropdown open after mouse interactions
              setTimeout(() => {
                isSelectingRef.current = false;
              }, 100);
            }}
          >
            {/* Account Type Filter */}
            {accountTypes.length > 0 && (
              <div className="px-3 py-2 border-b border-gray-200 bg-gray-50 flex-shrink-0">
                <select
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                  className="w-full text-xs border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  onFocus={() => {
                    isSelectingRef.current = true;
                  }}
                  onBlur={() => {
                    setTimeout(() => {
                      isSelectingRef.current = false;
                    }, 100);
                  }}
                >
                  <option value="">All Types</option>
                  {accountTypes.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Create Account Form */}
            {showCreateForm ? (
              <div className="p-3 border-b border-gray-200 bg-blue-50 flex-shrink-0">
                <div className="text-sm font-medium text-blue-900 mb-2">
                  Create New Account
                  <span className="text-xs font-normal text-blue-700 ml-2">
                    (Currency: {account?.currency_code || 'USD'})
                  </span>
                </div>
                <div className="flex flex-col space-y-2">
                  <input
                    type="text"
                    placeholder="Select category to auto-generate code"
                    value={newAccountData.code}
                    readOnly
                    className="w-full text-xs border border-gray-300 rounded px-2 py-1 bg-gray-50 text-gray-700 focus:outline-none"
                    title="Account code is auto-generated based on category"
                  />
                  <input
                    type="text"
                    placeholder="Account Name (e.g., Office Supplies)"
                    value={newAccountData.alias}
                    onChange={(e) => setNewAccountData(prev => ({ ...prev, alias: e.target.value }))}
                    className="w-full text-xs border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    onFocus={() => { isSelectingRef.current = true; }}
                    onBlur={() => { setTimeout(() => { isSelectingRef.current = false; }, 100); }}
                  />
                  <select
                    value={newAccountData.category}
                    onChange={(e) => {
                      const category = e.target.value;
                      const generatedCode = generateAccountCode(category);
                      setNewAccountData(prev => ({
                        ...prev,
                        category,
                        code: generatedCode
                      }));
                    }}
                    className="w-full text-xs border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    onFocus={() => { isSelectingRef.current = true; }}
                    onBlur={() => { setTimeout(() => { isSelectingRef.current = false; }, 100); }}
                  >
                    <option value="">Select Category</option>
                    <option value="asset">Asset</option>
                    <option value="liability">Liability</option>
                    <option value="equity">Equity</option>
                    <option value="income">Income</option>
                    <option value="expense">Expense</option>
                  </select>
                  <div className="flex flex-row gap-2 mt-2">
                    <button
                      onClick={handleCreateAccount}
                      className="flex-1 bg-blue-600 text-white text-xs py-1 px-2 rounded hover:bg-blue-700 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                      disabled={assigningTransaction === transactionId}
                    >
                      {assigningTransaction === transactionId ? (
                        <div className="flex items-center justify-center">
                          <div className="animate-spin h-3 w-3 border border-white border-t-transparent rounded-full mr-1"></div>
                          Creating...
                        </div>
                      ) : (
                        'Create & Assign'
                      )}
                    </button>
                    <button
                      onClick={() => {
                        setShowCreateForm(false);
                        setNewAccountData({ code: '', alias: '', category: '' });
                      }}
                      className="flex-1 bg-gray-300 text-gray-700 text-xs py-1 px-2 rounded hover:bg-gray-400 focus:outline-none focus:ring-1 focus:ring-gray-500"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            ) : null}

            {/* Account List */}
            <div className="overflow-auto max-h-48 flex flex-col">
              {!showCreateForm && (
                <button
                  onClick={() => {
                    setShowCreateForm(true);
                    isSelectingRef.current = true;
                  }}
                  className="w-full px-3 py-2 text-left hover:bg-blue-50 border-b border-gray-100 flex-shrink-0 bg-blue-25"
                >
                  <div className="font-medium text-sm text-blue-600">+ Create New Account</div>
                  <div className="text-xs text-blue-500">Add a new account and assign it</div>
                </button>
              )}

              {filteredAccounts.length > 0 ? (
                filteredAccounts.slice(0, 10).map((account) => (
                  <button
                    key={account.id}
                    onClick={() => {
                      handleAccountAssignment(transactionId, account.code, field);
                      setIsOpen(false);
                      setSearchTerm('');
                      setTypeFilter('');
                    }}
                    className="w-full px-3 py-2 text-left hover:bg-gray-50 border-b border-gray-100 last:border-b-0 flex-shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={assigningTransaction === transactionId}
                  >
                    <div className="flex justify-between items-center">
                      <div className="flex-1">
                        <div className="font-medium text-sm">{account.code}</div>
                        <div className="text-xs text-gray-500 truncate">{account.alias}</div>
                        {account.category && (
                          <div className="text-xs text-blue-500">{account.category}</div>
                        )}
                      </div>
                      {assigningTransaction === transactionId && (
                        <div className="flex items-center text-xs text-blue-600 ml-2">
                          <div className="animate-spin h-3 w-3 border border-blue-500 border-t-transparent rounded-full mr-1"></div>
                          Assigning...
                        </div>
                      )}
                    </div>
                  </button>
                ))
              ) : !showCreateForm ? (
                <div className="px-3 py-2 text-sm text-gray-500 flex-shrink-0">
                  {Array.isArray(activeAccounts) && activeAccounts.length > 0
                    ? 'No accounts found'
                    : 'Loading accounts...'}
                </div>
              ) : null}
            </div>
          </div>
        )}
      </div>
    );
  };

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

  if (!account) {
    return (
      <div className="p-6">
        <div className="text-gray-500">Account not found</div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <Link
          href="/accounts"
          className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700 mb-4"
        >
          <ArrowLeftIcon className="h-4 w-4 mr-1" />
          Back to Accounts
        </Link>

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {account.account_name}
            </h1>
            <p className="text-sm text-gray-500">
              {account.account_code} • {account.account_type}
            </p>
          </div>

          <div className="flex items-center space-x-4">
            <button
              onClick={() => setIsImportModalOpen(true)}
              className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              <ArrowUpTrayIcon className="h-5 w-5 mr-2" />
              Import Statement
            </button>

            <div className="text-right">
              <div className="text-2xl font-bold text-gray-900">
                {formatCurrency(account.current_balance, account.currency_code)}
              </div>
              <div className={`text-sm px-2 py-1 rounded-full inline-block ${
                account.account_status === 'Active'
                  ? 'bg-green-100 text-green-800'
                  : 'bg-red-100 text-red-800'
              }`}>
                {account.account_status}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Account Info */}
      <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Account Information</h2>
          {!isEditingAccount ? (
            <button
              onClick={handleEditAccount}
              className="px-3 py-1.5 text-sm bg-indigo-600 text-white rounded hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              Edit
            </button>
          ) : (
            <div className="flex space-x-2">
              <button
                onClick={handleCancelEdit}
                disabled={isSavingAccount}
                className="px-3 py-1.5 text-sm bg-gray-300 text-gray-700 rounded hover:bg-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-500 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveAccount}
                disabled={isSavingAccount}
                className="px-3 py-1.5 text-sm bg-green-600 text-white rounded hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 disabled:opacity-50"
              >
                {isSavingAccount ? 'Saving...' : 'Save'}
              </button>
            </div>
          )}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <dt className="text-sm font-medium text-gray-500">Account Code</dt>
            <dd className="text-sm text-gray-900">{account.account_code}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">Account Name</dt>
            {isEditingAccount ? (
              <input
                type="text"
                value={editedAccount.account_name || ''}
                onChange={(e) => setEditedAccount({ ...editedAccount, account_name: e.target.value })}
                className="text-sm border border-gray-300 rounded px-2 py-1 w-full focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            ) : (
              <dd className="text-sm text-gray-900">{account.account_name}</dd>
            )}
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">Category</dt>
            {isEditingAccount ? (
              <input
                type="text"
                value={editedAccount.category || ''}
                onChange={(e) => setEditedAccount({ ...editedAccount, category: e.target.value })}
                className="text-sm border border-gray-300 rounded px-2 py-1 w-full focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            ) : (
              <dd className="text-sm text-gray-900">{account.category || '-'}</dd>
            )}
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">Account Type</dt>
            {isEditingAccount ? (
              <select
                value={editedAccount.account_type || ''}
                onChange={(e) => setEditedAccount({ ...editedAccount, account_type: e.target.value as 'asset' | 'liability' | 'equity' | 'income' | 'expense' })}
                className="text-sm border border-gray-300 rounded px-2 py-1 w-full focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">-</option>
                <option value="asset">Asset</option>
                <option value="liability">Liability</option>
                <option value="equity">Equity</option>
                <option value="income">Income</option>
                <option value="expense">Expense</option>
              </select>
            ) : (
              <dd className="text-sm text-gray-900">{account.account_type || '-'}</dd>
            )}
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">Currency</dt>
            {isEditingAccount ? (
              <input
                type="text"
                value={editedAccount.currency_code || ''}
                onChange={(e) => setEditedAccount({ ...editedAccount, currency_code: e.target.value })}
                className="text-sm border border-gray-300 rounded px-2 py-1 w-full focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            ) : (
              <dd className="text-sm text-gray-900">{account.currency_code}</dd>
            )}
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">Status</dt>
            {isEditingAccount ? (
              <select
                value={editedAccount.account_status || ''}
                onChange={(e) => setEditedAccount({ ...editedAccount, account_status: e.target.value })}
                className="text-sm border border-gray-300 rounded px-2 py-1 w-full focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </select>
            ) : (
              <dd className="text-sm text-gray-900">{account.account_status}</dd>
            )}
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">Created</dt>
            <dd className="text-sm text-gray-900">{formatDate(account.created_at)}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">Last Updated</dt>
            <dd className="text-sm text-gray-900">{formatDate(account.updated_at)}</dd>
          </div>
        </div>
      </div>

      {/* Search and Filter Box */}
      <div className="bg-white rounded-lg shadow-sm border p-4 mb-6">
        <div className="space-y-4">
          <div className="flex items-center space-x-4">
            <div className="flex-1">
              <label htmlFor="transaction-search" className="block text-sm font-medium text-gray-700 mb-1">
                Search Transactions
              </label>
              <div className="relative">
                <input
                  id="transaction-search"
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search by description, account, amount..."
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
                <svg
                  className="absolute left-3 top-2.5 h-5 w-5 text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
              </div>
            </div>
            <div className="w-64">
              <label htmlFor="account-filter" className="block text-sm font-medium text-gray-700 mb-1">
                Account Status
              </label>
              <select
                id="account-filter"
                value={accountFilter}
                onChange={(e) => setAccountFilter(e.target.value as 'all' | 'empty' | 'filled')}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              >
                <option value="all">All Transactions</option>
                <option value="empty">Has Empty Account</option>
                <option value="filled">All Accounts Filled</option>
              </select>
            </div>
          </div>
          {(searchTerm || accountFilter !== 'all') && (
            <div className="flex items-center justify-between text-sm text-gray-600 pt-2 border-t border-gray-200">
              <span>
                Showing {filteredTransactions.length} of {transactions.length} transactions
              </span>
              <button
                onClick={() => {
                  setSearchTerm('');
                  setAccountFilter('all');
                }}
                className="text-indigo-600 hover:text-indigo-800 font-medium"
              >
                Clear all filters
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Transactions */}
      <div className="bg-white rounded-lg shadow-sm border">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold text-gray-900">Recent Transactions</h2>
            {searchTerm && (
              <span className="text-sm text-gray-500">
                Showing {filteredTransactions.length} of {transactions.length} transactions
              </span>
            )}
          </div>
        </div>

        {/* Bulk Actions Toolbar */}
        {selectedTransactions.size > 0 && (
          <div className="bg-indigo-50 border-b border-indigo-200 p-4">
            <div className="space-y-4">
              {/* Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <span className="text-sm font-medium text-indigo-900">
                    {selectedTransactions.size} transaction{selectedTransactions.size !== 1 ? 's' : ''} selected
                  </span>
                  <button
                    onClick={clearTransactionSelection}
                    className="text-sm text-indigo-600 hover:text-indigo-800"
                  >
                    Clear selection
                  </button>
                </div>
              </div>

              {/* Account Assignment Row */}
              <div className="flex items-center space-x-3">
                <span className="text-sm font-medium text-gray-700 min-w-max">Account Assignment:</span>
                <select
                  value={bulkAssignType}
                  onChange={(e) => setBulkAssignType(e.target.value as 'debit' | 'credit')}
                  className="text-sm border border-gray-300 rounded px-3 py-1 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="debit">Assign Debit Account</option>
                  <option value="credit">Assign Credit Account</option>
                </select>
                <select
                  value={bulkAssignAccount}
                  onChange={(e) => setBulkAssignAccount(e.target.value)}
                  className="text-sm border border-gray-300 rounded px-3 py-1 focus:outline-none focus:ring-2 focus:ring-indigo-500 min-w-48"
                >
                  <option value="">Select account...</option>
                  {Array.isArray(activeAccounts) && activeAccounts
                    .filter(acc => acc.currency === account?.currency_code)
                    .map((acc) => (
                      <option key={acc.id} value={acc.code}>
                        {acc.code} - {acc.alias}
                      </option>
                    ))}
                </select>
                <button
                  onClick={() => handleBulkAccountAssignment()}
                  disabled={!bulkAssignAccount}
                  className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Assign Account
                </button>
              </div>

              {/* Entity Assignment Row */}
              <div className="flex items-center space-x-3">
                <span className="text-sm font-medium text-gray-700 min-w-max">Entity Assignment:</span>
                <select
                  value={bulkAssignEntity}
                  onChange={(e) => setBulkAssignEntity(e.target.value)}
                  className="text-sm border border-gray-300 rounded px-3 py-1 focus:outline-none focus:ring-2 focus:ring-indigo-500 min-w-48"
                >
                  <option value="">Select entity...</option>
                  {entities.map((entity) => (
                    <option key={entity.id} value={entity.id.toString()}>
                      {entity.name || 'Unnamed Entity'} ({entity.code})
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => handleBulkEntityAssignment()}
                  disabled={!bulkAssignEntity}
                  className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Assign Entity
                </button>
              </div>

              {/* Delete Transactions Row */}
              <div className="flex items-center space-x-3 pt-2 border-t border-indigo-200">
                <span className="text-sm font-medium text-red-700 min-w-max">Danger Zone:</span>
                <button
                  onClick={() => handleBulkDeleteTransactions()}
                  className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500"
                >
                  Delete {selectedTransactions.size} Transaction{selectedTransactions.size !== 1 ? 's' : ''}
                </button>
              </div>
            </div>
          </div>
        )}

        {transactions.length === 0 ? (
          <div className="p-6 text-center text-gray-500">
            No transactions found for this account.
          </div>
        ) : filteredTransactions.length === 0 ? (
          <div className="p-6 text-center text-gray-500">
            No transactions match your search criteria.
            <button
              onClick={() => setSearchTerm('')}
              className="block mx-auto mt-2 text-indigo-600 hover:text-indigo-800"
            >
              Clear search
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-16">
                    <input
                      type="checkbox"
                      checked={isAllTransactionsSelected}
                      ref={(input) => {
                        if (input) input.indeterminate = isPartiallyTransactionsSelected;
                      }}
                      onChange={() => isAllTransactionsSelected ? clearTransactionSelection() : selectAllTransactions()}
                      className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                    />
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Description
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Debit Account
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Credit Account
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Debit
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Credit
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Amount
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Entity
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredTransactions.map((transaction) => (
                  <tr key={transaction.id} className={`hover:bg-gray-50 ${selectedTransactions.has(transaction.id) ? 'bg-indigo-50' : ''}`}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <input
                        type="checkbox"
                        checked={selectedTransactions.has(transaction.id)}
                        onChange={(e) => {
                          e.stopPropagation();
                          toggleTransactionSelection(transaction.id);
                        }}
                        className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                      />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatDate(transaction.fecha)}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {transaction.description}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <AccountAutocomplete
                        currentValue={transaction.debitacc}
                        transactionId={transaction.id}
                        field="debit"
                        isIncomplete={transaction.debitacc === '0'}
                        transaction={transaction}
                      />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <AccountAutocomplete
                        currentValue={transaction.creditacc}
                        transactionId={transaction.id}
                        field="credit"
                        isIncomplete={transaction.creditacc === '0'}
                        transaction={transaction}
                      />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                      {transaction.debit > 0 ? formatCurrency(transaction.debit, account.currency_code) : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                      {transaction.credit > 0 ? formatCurrency(transaction.credit, account.currency_code) : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-medium text-gray-900">
                      {transaction.transaction_type === 'debit' ?
                        formatCurrency(transaction.debit, account.currency_code) :
                        formatCurrency(-transaction.credit, account.currency_code)
                      }
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <EntitySelector
                        currentEntityId={transaction.entity_id}
                        currentEntityName={transaction.entity_name}
                        transactionId={transaction.id}
                        entities={entities}
                        onEntityAssign={handleEntityAssignment}
                        isAssigning={assigningEntity === transaction.id}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Statement Import Modal */}
      <StatementImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        account={account ? {
          id: account.account_id,
          code: account.account_code,
          alias: account.account_name,
          balance: account.current_balance,
          currency: account.currency_code,
          account_type: account.account_type as 'asset' | 'liability' | 'equity' | 'income' | 'expense',
          category: account.category || null,
          user: 0,
          client: null,
          active: 1,
          company: null,
          class1: null,
          class2: null,
          numero: account.account_code,
          bankID: null,
          user2: null,
          cartola: null,
          account: null,
          viewBalance: false,
          debitAccount: false,
          creditAccount: false,
          date_created: account.created_at,
          date_updated: account.updated_at
        } : null}
        onImportComplete={() => {
          setIsImportModalOpen(false);
          fetchAccountDetails();
        }}
      />
    </div>
  );
}