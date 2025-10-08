'use client';

import { Fragment, useState, useEffect } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { XMarkIcon, ScaleIcon, CheckCircleIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import { Account } from '@/lib/database';

interface ReconcileModalProps {
  isOpen: boolean;
  onClose: () => void;
  account: Account | null;
  onReconciliationComplete: () => void;
}

export default function ReconcileModal({ isOpen, onClose, account, onReconciliationComplete }: ReconcileModalProps) {
  const [bankBalance, setBankBalance] = useState('');
  const [reconciliationDate, setReconciliationDate] = useState('');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState<any>(null);

  // Initialize date to today
  useEffect(() => {
    if (isOpen) {
      const today = new Date().toISOString().split('T')[0];
      setReconciliationDate(today);
      setBankBalance('');
      setDescription('');
      setError('');
      setSuccess(null);
    }
  }, [isOpen]);

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

  const calculateDifference = () => {
    if (!bankBalance || !account) return 0;
    const bankAmount = parseFloat(bankBalance);
    if (isNaN(bankAmount)) return 0;
    return bankAmount - account.balance;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!account) return;

    setIsSubmitting(true);
    setError('');

    try {
      const bankAmount = parseFloat(bankBalance);
      if (isNaN(bankAmount)) {
        setError('Please enter a valid balance amount');
        return;
      }

      const response = await fetch(`/api/reconcile/${account.id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          bankBalance: bankAmount,
          reconciliationDate,
          description
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess(data);
        onReconciliationComplete();
      } else {
        setError(data.error || 'Failed to reconcile account');
      }
    } catch (err) {
      setError('Network error occurred');
      console.error('Reconciliation error:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      onClose();
    }
  };

  if (!account) return null;

  const difference = calculateDifference();

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={handleClose}>
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
              <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-white text-left align-middle shadow-xl transition-all">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-gray-200">
                  <div className="flex items-center">
                    <ScaleIcon className="h-6 w-6 text-indigo-600 mr-2" />
                    <Dialog.Title className="text-lg font-medium text-gray-900">
                      Reconcile Account
                    </Dialog.Title>
                  </div>
                  <button
                    onClick={handleClose}
                    disabled={isSubmitting}
                    className="text-gray-400 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded-full p-1"
                  >
                    <XMarkIcon className="h-5 w-5" />
                  </button>
                </div>

                {/* Content */}
                <div className="p-6">
                  {!success ? (
                    <>
                      {/* Account Info */}
                      <div className="bg-gray-50 rounded-lg p-4 mb-6">
                        <h3 className="font-medium text-gray-900 mb-2">{account.alias}</h3>
                        <p className="text-sm text-gray-600">{account.code} • {account.numero}</p>
                        <div className="mt-2">
                          <span className="text-sm text-gray-500">Current Balance:</span>
                          <span className="ml-2 font-medium text-gray-900">
                            {account.viewBalance ? formatCurrency(account.balance, account.currency) : '****'}
                          </span>
                        </div>
                      </div>

                      {/* Form */}
                      <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                          <label htmlFor="bankBalance" className="block text-sm font-medium text-gray-700">
                            Bank Statement Balance *
                          </label>
                          <input
                            type="number"
                            id="bankBalance"
                            step="0.01"
                            value={bankBalance}
                            onChange={(e) => setBankBalance(e.target.value)}
                            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                            placeholder="Enter balance from your bank statement"
                            required
                          />
                        </div>

                        <div>
                          <label htmlFor="reconciliationDate" className="block text-sm font-medium text-gray-700">
                            Statement Date *
                          </label>
                          <input
                            type="date"
                            id="reconciliationDate"
                            value={reconciliationDate}
                            onChange={(e) => setReconciliationDate(e.target.value)}
                            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                            required
                          />
                        </div>

                        <div>
                          <label htmlFor="description" className="block text-sm font-medium text-gray-700">
                            Description (Optional)
                          </label>
                          <textarea
                            id="description"
                            rows={2}
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                            placeholder="Add a note about this reconciliation..."
                          />
                        </div>

                        {/* Difference Display */}
                        {bankBalance && (
                          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                            <div className="flex items-center">
                              {Math.abs(difference) < 0.01 ? (
                                <CheckCircleIcon className="h-5 w-5 text-green-500 mr-2" />
                              ) : (
                                <ExclamationTriangleIcon className="h-5 w-5 text-yellow-500 mr-2" />
                              )}
                              <div className="flex-1">
                                <p className="text-sm font-medium text-gray-900">
                                  {Math.abs(difference) < 0.01 ? 'Account is balanced' : 'Adjustment needed'}
                                </p>
                                {Math.abs(difference) >= 0.01 && (
                                  <p className="text-sm text-gray-600">
                                    Difference: <span className={`font-medium ${difference > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                      {difference > 0 ? '+' : ''}{formatCurrency(difference, account.currency)}
                                    </span>
                                  </p>
                                )}
                              </div>
                            </div>
                          </div>
                        )}

                        {error && (
                          <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-md">
                            {error}
                          </div>
                        )}

                        <div className="flex space-x-3 pt-4">
                          <button
                            type="button"
                            onClick={handleClose}
                            disabled={isSubmitting}
                            className="flex-1 inline-flex justify-center py-2 px-4 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
                          >
                            Cancel
                          </button>
                          <button
                            type="submit"
                            disabled={isSubmitting || !bankBalance}
                            className="flex-1 inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {isSubmitting ? (
                              <>
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                                Reconciling...
                              </>
                            ) : (
                              'Reconcile Account'
                            )}
                          </button>
                        </div>
                      </form>
                    </>
                  ) : (
                    /* Success State */
                    <div className="text-center">
                      <CheckCircleIcon className="mx-auto h-12 w-12 text-green-500 mb-4" />
                      <h3 className="text-lg font-medium text-gray-900 mb-2">
                        Account Reconciled Successfully!
                      </h3>
                      <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
                        <div className="text-sm space-y-1">
                          <p><span className="font-medium">Previous Balance:</span> {formatCurrency(success.transaction.previousBalance, account.currency)}</p>
                          <p><span className="font-medium">New Balance:</span> {formatCurrency(success.transaction.newBalance, account.currency)}</p>
                          <p><span className="font-medium">Adjustment:</span>
                            <span className={success.transaction.difference > 0 ? 'text-green-600' : 'text-red-600'}>
                              {success.transaction.difference > 0 ? '+' : ''}{formatCurrency(success.transaction.difference, account.currency)}
                            </span>
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={handleClose}
                        className="w-full inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                      >
                        Close
                      </button>
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