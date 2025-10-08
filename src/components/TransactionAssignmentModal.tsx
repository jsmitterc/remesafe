'use client';

import { Fragment, useState, useEffect } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import {
  XMarkIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  CurrencyDollarIcon,
  BuildingOfficeIcon
} from '@heroicons/react/24/outline';
import { Account, Transaction } from '@/lib/database';

interface TransactionAssignmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  transaction: Transaction | null;
  onAssignmentComplete: () => void;
  accountCode?: string;
}

export default function TransactionAssignmentModal({
  isOpen,
  onClose,
  transaction,
  onAssignmentComplete,
  accountCode
}: TransactionAssignmentModalProps) {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [filteredAccounts, setFilteredAccounts] = useState<Account[]>([]);
  const [selectedAccountCode, setSelectedAccountCode] = useState('');
  const [selectedAccountType, setSelectedAccountType] = useState<'income' | 'expense' | 'asset' | 'liability' | 'equity' | ''>('');
  const [isDebitAccount, setIsDebitAccount] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [incompleteTransactions, setIncompleteTransactions] = useState<Transaction[]>([]);
  const [currentTransactionIndex, setCurrentTransactionIndex] = useState(0);
  const [isLoadingNext, setIsLoadingNext] = useState(false);

  // Load accounts and incomplete transactions when modal opens
  useEffect(() => {
    if (isOpen && accountCode) {
      fetchAccounts();
      fetchIncompleteTransactions();
      setSelectedAccountCode('');
      setSelectedAccountType('');
      setError('');
      setSuccess(false);
      setSearchTerm('');
      setCurrentTransactionIndex(0);
    }
  }, [isOpen, accountCode]);

  // Update current transaction when index changes
  useEffect(() => {
    if (incompleteTransactions.length > 0 && currentTransactionIndex < incompleteTransactions.length) {
      const currentTransaction = incompleteTransactions[currentTransactionIndex];
      setIsDebitAccount(currentTransaction.debitacc === '0');
      setError('');
      setSelectedAccountCode('');
    }
  }, [currentTransactionIndex, incompleteTransactions]);

  // Filter accounts when search term or account type changes
  useEffect(() => {
    let filtered = accounts;

    if (selectedAccountType) {
      filtered = filtered.filter(account => account.account_type === selectedAccountType);
    }

    if (searchTerm) {
      filtered = filtered.filter(account =>
        account.alias.toLowerCase().includes(searchTerm.toLowerCase()) ||
        account.code.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    setFilteredAccounts(filtered);
  }, [accounts, selectedAccountType, searchTerm]);

  const fetchAccounts = async () => {
    try {
      const response = await fetch('/api/accounts-for-assignment');
      const data = await response.json();

      if (response.ok) {
        setAccounts(data.accounts);
        setFilteredAccounts(data.accounts);
      } else {
        setError(data.error || 'Failed to load accounts');
      }
    } catch (err) {
      setError('Network error occurred');
      console.error('Failed to fetch accounts:', err);
    }
  };

  const fetchIncompleteTransactions = async () => {
    if (!accountCode) return;

    try {
      const response = await fetch(`/api/incomplete-transactions/${accountCode}?limit=20`);
      const data = await response.json();

      if (response.ok) {
        setIncompleteTransactions(data.transactions);
      } else {
        setError(data.error || 'Failed to load incomplete transactions');
      }
    } catch (err) {
      setError('Network error occurred');
      console.error('Failed to fetch incomplete transactions:', err);
    }
  };

  const handleAssignment = async () => {
    const currentTransaction = incompleteTransactions[currentTransactionIndex];
    if (!currentTransaction || !selectedAccountCode) return;

    setIsSubmitting(true);
    setError('');

    try {
      const response = await fetch('/api/assign-account', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          transactionId: currentTransaction.id,
          assignedAccountCode: selectedAccountCode,
          isDebitAccount: isDebitAccount
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess(true);
        onAssignmentComplete();

        // Remove assigned transaction from the list
        const updatedTransactions = incompleteTransactions.filter((_, index) => index !== currentTransactionIndex);
        setIncompleteTransactions(updatedTransactions);

        // Move to next transaction or close if no more
        if (updatedTransactions.length === 0) {
          setTimeout(() => {
            onClose();
          }, 1500);
        } else {
          // Adjust index if we're at the end of the list
          const nextIndex = currentTransactionIndex >= updatedTransactions.length ? 0 : currentTransactionIndex;

          setTimeout(() => {
            setCurrentTransactionIndex(nextIndex);
            setSelectedAccountCode('');
            setSuccess(false);
          }, 800); // Small delay to show success message
        }
      } else {
        setError(data.error || 'Failed to assign account');
      }
    } catch (err) {
      setError('Network error occurred');
      console.error('Assignment error:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const getAccountTypeColor = (type: string) => {
    switch (type) {
      case 'income':
        return 'bg-green-100 text-green-800';
      case 'expense':
        return 'bg-red-100 text-red-800';
      case 'asset':
        return 'bg-blue-100 text-blue-800';
      case 'liability':
        return 'bg-yellow-100 text-yellow-800';
      case 'equity':
        return 'bg-purple-100 text-purple-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const currentTransaction = incompleteTransactions[currentTransactionIndex];

  // Show loading state while fetching transactions
  if (!isOpen) return null;
  if (incompleteTransactions.length === 0 && accountCode) {
    return (
      <Transition appear show={isOpen} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={onClose}>
          <div className="fixed inset-0 bg-black bg-opacity-25" />
          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4 text-center">
              <div className="w-full max-w-md transform overflow-hidden rounded-2xl bg-white p-6 text-left align-middle shadow-xl transition-all">
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
                  <span className="ml-3 text-gray-600">Loading incomplete transactions...</span>
                </div>
              </div>
            </div>
          </div>
        </Dialog>
      </Transition>
    );
  }

  // Show "no incomplete transactions" if list is empty after loading
  if (incompleteTransactions.length === 0) {
    return (
      <Transition appear show={isOpen} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={onClose}>
          <div className="fixed inset-0 bg-black bg-opacity-25" />
          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4 text-center">
              <div className="w-full max-w-md transform overflow-hidden rounded-2xl bg-white p-6 text-left align-middle shadow-xl transition-all">
                <div className="text-center py-12">
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No Incomplete Transactions</h3>
                  <p className="text-sm text-gray-500 mb-4">All transactions for this account are complete.</p>
                  <button
                    onClick={onClose}
                    className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        </Dialog>
      </Transition>
    );
  }

  if (!currentTransaction) return null;

  const selectedAccount = accounts.find(acc => acc.code === selectedAccountCode);
  const missingAccountType = currentTransaction?.debitacc === '0' ? 'Debit Account' : 'Credit Account';

  const handlePrevious = () => {
    if (currentTransactionIndex > 0) {
      setCurrentTransactionIndex(currentTransactionIndex - 1);
    }
  };

  const handleNext = () => {
    if (currentTransactionIndex < incompleteTransactions.length - 1) {
      setCurrentTransactionIndex(currentTransactionIndex + 1);
    }
  };

  const handleSkip = () => {
    if (currentTransactionIndex < incompleteTransactions.length - 1) {
      setCurrentTransactionIndex(currentTransactionIndex + 1);
    } else {
      onClose();
    }
  };

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black bg-opacity-25" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4 text-center">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-4xl transform overflow-hidden rounded-2xl bg-white text-left align-middle shadow-xl transition-all">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-gray-200">
                  <div className="flex items-center">
                    <BuildingOfficeIcon className="h-6 w-6 text-indigo-600 mr-2" />
                    <div>
                      <Dialog.Title className="text-lg font-medium text-gray-900">
                        Assign Account to Transaction
                      </Dialog.Title>
                      <p className="text-sm text-gray-500">
                        Transaction {currentTransactionIndex + 1} of {incompleteTransactions.length} - Complete the double-entry bookkeeping
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={onClose}
                    disabled={isSubmitting}
                    className="text-gray-400 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded-full p-1"
                  >
                    <XMarkIcon className="h-5 w-5" />
                  </button>
                </div>

                {/* Content */}
                <div className="p-6">
                  {success ? (
                    <div className="text-center py-8">
                      <CheckCircleIcon className="mx-auto h-12 w-12 text-green-500 mb-4" />
                      <h3 className="text-lg font-medium text-gray-900 mb-2">
                        Account Assigned Successfully!
                      </h3>
                      <p className="text-sm text-gray-500">
                        The transaction has been completed with double-entry bookkeeping.
                      </p>
                    </div>
                  ) : (
                    <>
                      {/* Transaction Details */}
                      <div className="bg-gray-50 rounded-lg p-4 mb-6">
                        <h3 className="font-medium text-gray-900 mb-3">Transaction Details</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <p className="text-sm text-gray-500">Description</p>
                            <p className="font-medium">{currentTransaction.description || currentTransaction.name}</p>
                          </div>
                          <div>
                            <p className="text-sm text-gray-500">Date</p>
                            <p className="font-medium">{new Date(currentTransaction.fecha).toLocaleDateString()}</p>
                          </div>
                          <div>
                            <p className="text-sm text-gray-500">Amount</p>
                            <p className="font-medium">
                              {currentTransaction.debit > 0 ? formatCurrency(currentTransaction.debit) : formatCurrency(currentTransaction.credit)}
                            </p>
                          </div>
                          <div>
                            <p className="text-sm text-gray-500">Missing</p>
                            <div className="flex items-center">
                              <ExclamationTriangleIcon className="h-4 w-4 text-yellow-500 mr-1" />
                              <span className="font-medium text-yellow-700">{missingAccountType}</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Current Accounts */}
                      <div className="bg-blue-50 rounded-lg p-4 mb-6">
                        <h3 className="font-medium text-gray-900 mb-3">Current Account Assignment</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <p className="text-sm text-gray-500">Debit Account</p>
                            <p className="font-medium">
                              {currentTransaction.debitacc !== '0' ? currentTransaction.debitacc : (
                                <span className="text-red-600 flex items-center">
                                  <ExclamationTriangleIcon className="h-4 w-4 mr-1" />
                                  Not Assigned
                                </span>
                              )}
                            </p>
                          </div>
                          <div>
                            <p className="text-sm text-gray-500">Credit Account</p>
                            <p className="font-medium">
                              {currentTransaction.creditacc !== '0' ? currentTransaction.creditacc : (
                                <span className="text-red-600 flex items-center">
                                  <ExclamationTriangleIcon className="h-4 w-4 mr-1" />
                                  Not Assigned
                                </span>
                              )}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Account Selection */}
                      <div className="space-y-4">
                        <h3 className="font-medium text-gray-900">
                          Select {missingAccountType}
                        </h3>

                        {/* Filters */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Account Type
                            </label>
                            <select
                              value={selectedAccountType}
                              onChange={(e) => setSelectedAccountType(e.target.value as '' | 'income' | 'expense' | 'asset' | 'liability' | 'equity')}
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                            >
                              <option value="">All Types</option>
                              <option value="income">Income</option>
                              <option value="expense">Expense</option>
                              <option value="asset">Asset</option>
                              <option value="liability">Liability</option>
                              <option value="equity">Equity</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Search Accounts
                            </label>
                            <input
                              type="text"
                              value={searchTerm}
                              onChange={(e) => setSearchTerm(e.target.value)}
                              placeholder="Search by name or code..."
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                            />
                          </div>
                        </div>

                        {/* Account List */}
                        <div className="border border-gray-200 rounded-lg max-h-64 overflow-y-auto">
                          {filteredAccounts.length === 0 ? (
                            <div className="p-4 text-center text-gray-500">
                              No accounts found
                            </div>
                          ) : (
                            <div className="space-y-1 p-2">
                              {filteredAccounts.map((account) => (
                                <button
                                  key={account.id}
                                  onClick={() => setSelectedAccountCode(account.code)}
                                  className={`w-full text-left p-3 rounded-lg transition-colors ${
                                    selectedAccountCode === account.code
                                      ? 'bg-indigo-50 border-2 border-indigo-200'
                                      : 'hover:bg-gray-50 border-2 border-transparent'
                                  }`}
                                >
                                  <div className="flex items-center justify-between">
                                    <div>
                                      <p className="font-medium text-gray-900">{account.alias}</p>
                                      <p className="text-sm text-gray-500">{account.code}</p>
                                    </div>
                                    {account.account_type && (
                                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getAccountTypeColor(account.account_type)}`}>
                                        {account.account_type}
                                      </span>
                                    )}
                                  </div>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Selected Account Summary */}
                        {selectedAccount && (
                          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                            <h4 className="font-medium text-green-900 mb-2">Selected Account</h4>
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="font-medium text-green-900">{selectedAccount.alias}</p>
                                <p className="text-sm text-green-700">{selectedAccount.code}</p>
                              </div>
                              {selectedAccount.account_type && (
                                <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getAccountTypeColor(selectedAccount.account_type)}`}>
                                  {selectedAccount.account_type}
                                </span>
                              )}
                            </div>
                          </div>
                        )}

                        {error && (
                          <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-md">
                            {error}
                          </div>
                        )}

                        {/* Navigation and Action Buttons */}
                        <div className="flex space-x-3 pt-4">
                          <button
                            onClick={handlePrevious}
                            disabled={currentTransactionIndex === 0 || isSubmitting}
                            className="inline-flex items-center py-2 px-4 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
                          >
                            ← Previous
                          </button>
                          <button
                            onClick={handleSkip}
                            disabled={isSubmitting}
                            className="inline-flex items-center py-2 px-4 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
                          >
                            Skip
                          </button>
                          <button
                            onClick={handleNext}
                            disabled={currentTransactionIndex >= incompleteTransactions.length - 1 || isSubmitting}
                            className="inline-flex items-center py-2 px-4 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
                          >
                            Next →
                          </button>
                          <button
                            onClick={onClose}
                            disabled={isSubmitting}
                            className="inline-flex justify-center py-2 px-4 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
                          >
                            Close
                          </button>
                          <button
                            onClick={handleAssignment}
                            disabled={isSubmitting || !selectedAccountCode}
                            className="flex-1 inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {isSubmitting ? (
                              <>
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                                Assigning...
                              </>
                            ) : (
                              'Assign Account'
                            )}
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}