'use client';

import { Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { XMarkIcon, ArrowDownIcon, ArrowUpIcon } from '@heroicons/react/24/outline';
import { useTransactionsData } from '@/hooks/useTransactionsData';
import { Account } from '@/lib/database';

interface TransactionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  account: Account | null;
}

export default function TransactionsModal({ isOpen, onClose, account }: TransactionsModalProps) {
  const { transactions, loading, error, hasMore, loadMore } = useTransactionsData(account?.id || null);

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
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return dateString;
    }
  };

  if (!account) return null;

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
          <div className="fixed inset-0 bg-opacity-25" />
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
              <Dialog.Panel className="w-full max-w-6xl transform overflow-hidden rounded-2xl bg-white text-left align-middle shadow-xl transition-all">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-gray-200">
                  <div>
                    <Dialog.Title className="text-2xl font-bold text-gray-900">
                      {account.alias}
                    </Dialog.Title>
                    <p className="text-gray-600 mt-1">
                      {account.code} • {account.numero}
                    </p>
                  </div>
                  <button
                    onClick={onClose}
                    className="text-gray-400 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded-full p-2"
                  >
                    <XMarkIcon className="h-6 w-6" />
                  </button>
                </div>

                {/* Content */}
                <div className="p-6">
                  {loading && transactions.length === 0 && (
                    <div className="flex items-center justify-center py-12">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
                      <span className="ml-3 text-gray-600">Loading transactions...</span>
                    </div>
                  )}

                  {error && (
                    <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-md mb-6">
                      Error: {error}
                    </div>
                  )}

                  {!loading && !error && transactions.length === 0 && (
                    <div className="text-center py-12">
                      <div className="text-gray-400 text-6xl mb-4">📋</div>
                      <h3 className="text-lg font-medium text-gray-900 mb-2">No transactions found</h3>
                      <p className="text-gray-500">This account doesn&apos;t have any transactions yet.</p>
                    </div>
                  )}

                  {transactions.length > 0 && (
                    <div className="space-y-4">
                      <div className="text-sm text-gray-600 mb-4">
                        Showing {transactions.length} transaction{transactions.length !== 1 ? 's' : ''}
                      </div>

                      <div className="space-y-2">
                        {transactions.map((transaction) => (
                          <div
                            key={transaction.id}
                            className="bg-gray-50 rounded-lg p-4 hover:bg-gray-100 transition-colors"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center space-x-3">
                                {transaction.transaction_type === 'debit' ? (
                                  <ArrowUpIcon className="h-5 w-5 text-red-500" />
                                ) : (
                                  <ArrowDownIcon className="h-5 w-5 text-green-500" />
                                )}

                                <div>
                                  <div className="font-medium text-gray-900">
                                    {transaction.name}
                                  </div>
                                  <div className="text-sm text-gray-600">
                                    {transaction.transaction_type === 'debit' ? 'To' : 'From'}: {' '}
                                    {transaction.other_account_alias || transaction.other_account_code}
                                  </div>
                                  {transaction.description && (
                                    <div className="text-xs text-gray-500 mt-1">
                                      {transaction.description}
                                    </div>
                                  )}
                                </div>
                              </div>

                              <div className="text-right">
                                <div className={`font-medium ${
                                  transaction.transaction_type === 'debit' ? 'text-red-600' : 'text-green-600'
                                }`}>
                                  {transaction.transaction_type === 'debit' ? '-' : '+'}
                                  {formatCurrency(
                                    transaction.transaction_type === 'debit' ? transaction.debit : transaction.credit,
                                    account.currency
                                  )}
                                </div>
                                <div className="text-xs text-gray-500">
                                  {formatDate(transaction.fecha)}
                                </div>
                                {transaction.status && (
                                  <div className="text-xs">
                                    <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                                      {transaction.status}
                                    </span>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>

                      {hasMore && (
                        <div className="flex justify-center pt-4">
                          <button
                            onClick={loadMore}
                            disabled={loading}
                            className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {loading ? (
                              <>
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-500 mr-2"></div>
                                Loading...
                              </>
                            ) : (
                              'Load More'
                            )}
                          </button>
                        </div>
                      )}
                    </div>
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