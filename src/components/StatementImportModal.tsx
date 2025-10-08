'use client';

import { Fragment, useState, useEffect, useRef } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import {
  XMarkIcon,
  DocumentTextIcon,
  PlusIcon,
  TrashIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  CloudArrowUpIcon,
  ArrowRightIcon,
  ArrowLeftIcon
} from '@heroicons/react/24/outline';
import { Account, StatementTransaction } from '@/lib/database';
import Papa from 'papaparse';

interface StatementImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  account: Account | null;
  onImportComplete: () => void;
}

type ImportStep = 'upload' | 'review' | 'success';

interface CSVColumn {
  name: string;
  mapping: 'date' | 'description' | 'amount' | 'type' | 'ignore';
}

export default function StatementImportModal({ isOpen, onClose, account, onImportComplete }: StatementImportModalProps) {
  const [currentStep, setCurrentStep] = useState<ImportStep>('upload');
  const [statementDate, setStatementDate] = useState('');
  const [openingBalance, setOpeningBalance] = useState('');
  const [closingBalance, setClosingBalance] = useState('');
  const [transactions, setTransactions] = useState<StatementTransaction[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState<any>(null);

  // CSV related state
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvData, setCsvData] = useState<string[][]>([]);
  const [csvColumns, setCsvColumns] = useState<CSVColumn[]>([]);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Initialize form
  useEffect(() => {
    if (isOpen && account) {
      const today = new Date().toISOString().split('T')[0];
      setCurrentStep('upload');
      setStatementDate(today);
      setOpeningBalance(account.balance.toString());
      setClosingBalance('');
      setTransactions([]);
      setCsvFile(null);
      setCsvData([]);
      setCsvColumns([]);
      setCsvHeaders([]);
      setError('');
      setSuccess(null);
    }
  }, [isOpen, account]);

  const createEmptyTransaction = (): StatementTransaction => ({
    id: Math.random().toString(36).substr(2, 9),
    date: statementDate || new Date().toISOString().split('T')[0],
    description: '',
    amount: 0,
    type: 'debit',
    category: 'Bank Transaction'
  });

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

  const calculateRunningBalance = () => {
    let balance = parseFloat(openingBalance) || 0;

    // Simply add all amounts (they're already signed: positive or negative)
    transactions.forEach(txn => {
      balance += txn.amount;
    });

    return balance;
  };

  const getBalanceDifference = () => {
    const calculated = calculateRunningBalance();
    const expected = parseFloat(closingBalance) || 0;
    return calculated - expected;
  };

  const addTransaction = () => {
    setTransactions([...transactions, createEmptyTransaction()]);
  };

  const removeTransaction = (id: string) => {
    setTransactions(transactions.filter(txn => txn.id !== id));
  };

  const updateTransaction = (id: string, field: keyof StatementTransaction, value: any) => {
    setTransactions(transactions.map(txn =>
      txn.id === id ? { ...txn, [field]: value } : txn
    ));
  };

  // CSV handling functions
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setCsvFile(file);
    setError('');

    Papa.parse(file, {
      complete: (results) => {
        if (results.data && results.data.length > 0) {
          const data = results.data as string[][];
          const headers = data[0];
          const rows = data.slice(1).filter(row => row.some(cell => cell.trim() !== ''));

          setCsvHeaders(headers);
          setCsvData(rows);

          // Initialize column mappings with smart guessing
          const columns: CSVColumn[] = headers.map(header => ({
            name: header,
            mapping: guessColumnType(header)
          }));
          setCsvColumns(columns);
        }
      },
      header: false,
      skipEmptyLines: true
    });
  };

  const guessColumnType = (header: string): CSVColumn['mapping'] => {
    const h = header.toLowerCase();
    if (h.includes('date') || h.includes('fecha')) return 'date';
    if (h.includes('description') || h.includes('desc') || h.includes('detail')) return 'description';
    if (h.includes('amount') || h.includes('value') || h.includes('monto')) return 'amount';
    if (h.includes('type') || h.includes('debit') || h.includes('credit')) return 'type';
    return 'ignore';
  };

  const updateColumnMapping = (index: number, mapping: CSVColumn['mapping']) => {
    setCsvColumns(prev => prev.map((col, i) =>
      i === index ? { ...col, mapping } : col
    ));
  };

  const parseCSVToTransactions = () => {
    if (!csvData.length || !csvColumns.length) return;

    const dateIndex = csvColumns.findIndex(col => col.mapping === 'date');
    const descriptionIndex = csvColumns.findIndex(col => col.mapping === 'description');
    const amountIndex = csvColumns.findIndex(col => col.mapping === 'amount');
    const typeIndex = csvColumns.findIndex(col => col.mapping === 'type');

    if (dateIndex === -1 || descriptionIndex === -1 || amountIndex === -1) {
      setError('Please map at least Date, Description, and Amount columns');
      return;
    }

    // Helper function to parse date from various formats
    const parseDate = (dateStr: string): string => {
      if (!dateStr) return statementDate;

      // Try DD/MM/YYYY format first (common in CSV exports)
      const ddmmyyyy = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
      if (ddmmyyyy) {
        const [, day, month, year] = ddmmyyyy;
        return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
      }

      // Try MM/DD/YYYY format
      const mmddyyyy = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
      if (mmddyyyy) {
        const [, month, day, year] = mmddyyyy;
        return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
      }

      // Try YYYY-MM-DD format (already correct)
      if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
        return dateStr;
      }

      // Try to parse with Date constructor and format
      try {
        const date = new Date(dateStr);
        if (!isNaN(date.getTime())) {
          return date.toISOString().split('T')[0];
        }
      } catch (e) {
        // Ignore parsing errors
      }

      // Fallback to statement date
      return statementDate;
    };

    const parsedTransactions: StatementTransaction[] = csvData.map((row, index) => {
      // Clean amount string by removing commas, currency symbols, and other non-numeric characters
      // except decimal point and minus sign
      const cleanAmount = (amountStr: string): string => {
        return amountStr.replace(/[^\d.-]/g, '');
      };

      const cleanedAmountStr = cleanAmount(row[amountIndex] || '0');
      const signedAmount = parseFloat(cleanedAmountStr) || 0;

      // Determine transaction type based on account type and amount sign
      // DEBIT increases: Assets, Expenses
      // CREDIT increases: Liabilities, Equity, Income

      const accountType = account?.account_type;

      console.log('Account Type:', accountType);
      const debitIncreasesBalance = accountType === 'asset' || accountType === 'expense';

      let type: 'debit' | 'credit';

      if (typeIndex !== -1) {
        // Override with explicit type from CSV if mapped
        const typeValue = row[typeIndex]?.toLowerCase();
        if (typeValue.includes('credit') || typeValue.includes('+')) {
          type = 'credit';
        } else {
          type = 'debit';
        }
      } else {

        console.log(row)
        console.log(debitIncreasesBalance)
        // Determine type based on account type and amount sign
        if (debitIncreasesBalance) {
          // Debit increases: positive = debit, negative = credit
          type = signedAmount >= 0 ? 'debit' : 'credit';
        } else {
          // Credit increases: positive = credit, negative = debit
          type = signedAmount >= 0 ? 'credit' : 'debit';
        }
      }

      return {
        id: Math.random().toString(36).substr(2, 9),
        date: parseDate(row[dateIndex]),
        description: row[descriptionIndex] || `Transaction ${index + 1}`,
        amount: signedAmount,  // Keep the sign for now, will convert before submit
        type: type,
        category: 'Bank Transaction'
      };
    });

    setTransactions(parsedTransactions);
    setCurrentStep('review');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!account) return;

    // Validate form
    const validTransactions = transactions.filter(txn =>
      txn.description.trim() && txn.amount !== 0
    );

    if (validTransactions.length === 0) {
      setError('Please add at least one valid transaction');
      return;
    }

    const balanceDifference = Math.abs(getBalanceDifference());
    if (balanceDifference > 0.01) {
      setError(`Statement doesn't balance. Difference: ${formatCurrency(getBalanceDifference(), account.currency)}`);
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      // Convert amounts to absolute values before sending to backend
      const transactionsForSubmit = validTransactions.map(txn => ({
        ...txn,
        amount: Math.abs(txn.amount)
      }));

      const response = await fetch(`/api/import-statement/${account.id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          statementDate,
          openingBalance: parseFloat(openingBalance),
          closingBalance: parseFloat(closingBalance),
          transactions: transactionsForSubmit
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess(data);
        setCurrentStep('success');
        onImportComplete();
      } else {
        setError(data.error || 'Failed to import statement');
      }
    } catch (err) {
      setError('Network error occurred');
      console.error('Statement import error:', err);
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

  const runningBalance = calculateRunningBalance();
  const difference = getBalanceDifference();
  const isBalanced = Math.abs(difference) < 0.01;

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
              <Dialog.Panel className="w-full max-w-6xl transform overflow-hidden rounded-2xl bg-white text-left align-middle shadow-xl transition-all">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-gray-200">
                  <div className="flex items-center">
                    <DocumentTextIcon className="h-6 w-6 text-indigo-600 mr-2" />
                    <div>
                      <Dialog.Title className="text-lg font-medium text-gray-900">
                        Import Bank Statement
                      </Dialog.Title>
                      <p className="text-sm text-gray-500">
                        {currentStep === 'upload' && 'Step 1: Upload CSV & Map Columns'}
                        {currentStep === 'review' && 'Step 2: Review & Edit Transactions'}
                        {currentStep === 'success' && 'Import Complete'}
                      </p>
                    </div>
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
                  {currentStep === 'upload' && (
                    <div className="space-y-6">
                      {/* Account Info */}
                      <div className="bg-gray-50 rounded-lg p-4">
                        <h3 className="font-medium text-gray-900 mb-2">{account?.alias}</h3>
                        <p className="text-sm text-gray-600">{account?.code} • {account?.numero}</p>
                      </div>

                      {/* Statement Details */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <label htmlFor="statementDate" className="block text-sm font-medium text-gray-700">
                            Statement Date *
                          </label>
                          <input
                            type="date"
                            id="statementDate"
                            value={statementDate}
                            onChange={(e) => setStatementDate(e.target.value)}
                            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                            required
                          />
                        </div>
                        <div>
                          <label htmlFor="openingBalance" className="block text-sm font-medium text-gray-700">
                            Opening Balance *
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            id="openingBalance"
                            value={openingBalance}
                            onChange={(e) => setOpeningBalance(e.target.value)}
                            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                            required
                          />
                        </div>
                        <div>
                          <label htmlFor="closingBalance" className="block text-sm font-medium text-gray-700">
                            Closing Balance *
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            id="closingBalance"
                            value={closingBalance}
                            onChange={(e) => setClosingBalance(e.target.value)}
                            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                            required
                          />
                        </div>
                      </div>

                      {/* CSV Upload */}
                      <div className="border-2 border-dashed border-gray-300 rounded-lg p-6">
                        <div className="text-center">
                          <CloudArrowUpIcon className="mx-auto h-12 w-12 text-gray-400" />
                          <div className="mt-4">
                            <label htmlFor="file-upload" className="cursor-pointer">
                              <span className="mt-2 block text-sm font-medium text-gray-900">
                                Upload CSV Bank Statement
                              </span>
                              <span className="mt-1 block text-sm text-gray-500">
                                CSV files up to 10MB
                              </span>
                            </label>
                            <input
                              ref={fileInputRef}
                              id="file-upload"
                              name="file-upload"
                              type="file"
                              accept=".csv"
                              className="sr-only"
                              onChange={handleFileUpload}
                            />
                          </div>
                          <div className="mt-4">
                            <button
                              type="button"
                              onClick={() => fileInputRef.current?.click()}
                              className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                            >
                              Choose CSV File
                            </button>
                          </div>
                        </div>

                        {csvFile && (
                          <div className="mt-4 text-center">
                            <p className="text-sm text-gray-600">
                              Selected: <span className="font-medium">{csvFile.name}</span>
                            </p>
                          </div>
                        )}
                      </div>

                      {/* Column Mapping */}
                      {csvHeaders.length > 0 && (
                        <div className="space-y-4">
                          <h3 className="text-lg font-medium text-gray-900">Map CSV Columns</h3>
                          <div className="space-y-3">
                            {csvColumns.map((column, index) => (
                              <div key={index} className="grid grid-cols-2 gap-4 items-center">
                                <div className="text-sm font-medium text-gray-900">
                                  {column.name}
                                </div>
                                <select
                                  value={column.mapping}
                                  onChange={(e) => updateColumnMapping(index, e.target.value as CSVColumn['mapping'])}
                                  className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                                >
                                  <option value="ignore">Ignore</option>
                                  <option value="date">Date</option>
                                  <option value="description">Description</option>
                                  <option value="amount">Amount</option>
                                  <option value="type">Transaction Type</option>
                                </select>
                              </div>
                            ))}
                          </div>

                          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                            <p className="text-sm text-blue-800">
                              <strong>Required:</strong> Date, Description, and Amount columns must be mapped.
                              <br />
                              <strong>Amount Sign:</strong> Positive amounts increase the account, negative amounts decrease it.
                              <br />
                              • <strong>Assets</strong> (Bank/Savings): Positive = Deposit, Negative = Withdrawal
                              <br />
                              • <strong>Liabilities</strong> (Credit Cards): Positive = Charge, Negative = Payment
                            </p>
                          </div>

                          {csvData.length > 0 && (
                            <div className="text-center">
                              <button
                                type="button"
                                onClick={parseCSVToTransactions}
                                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                              >
                                Parse Transactions
                                <ArrowRightIcon className="ml-2 h-4 w-4" />
                              </button>
                            </div>
                          )}
                        </div>
                      )}

                      {error && (
                        <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-md">
                          {error}
                        </div>
                      )}
                    </div>
                  )}

                  {currentStep === 'review' && (
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

                      <form onSubmit={handleSubmit} className="space-y-6">
                        {/* Statement Details */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div>
                            <label htmlFor="statementDate" className="block text-sm font-medium text-gray-700">
                              Statement Date *
                            </label>
                            <input
                              type="date"
                              id="statementDate"
                              value={statementDate}
                              onChange={(e) => setStatementDate(e.target.value)}
                              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                              required
                            />
                          </div>
                          <div>
                            <label htmlFor="openingBalance" className="block text-sm font-medium text-gray-700">
                              Opening Balance *
                            </label>
                            <input
                              type="number"
                              step="0.01"
                              id="openingBalance"
                              value={openingBalance}
                              onChange={(e) => setOpeningBalance(e.target.value)}
                              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                              required
                            />
                          </div>
                          <div>
                            <label htmlFor="closingBalance" className="block text-sm font-medium text-gray-700">
                              Closing Balance *
                            </label>
                            <input
                              type="number"
                              step="0.01"
                              id="closingBalance"
                              value={closingBalance}
                              onChange={(e) => setClosingBalance(e.target.value)}
                              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                              required
                            />
                          </div>
                        </div>

                        {/* Transactions */}
                        <div>
                          <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-medium text-gray-900">Transactions</h3>
                            <button
                              type="button"
                              onClick={addTransaction}
                              className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-indigo-700 bg-indigo-100 hover:bg-indigo-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                            >
                              <PlusIcon className="h-4 w-4 mr-1" />
                              Add Transaction
                            </button>
                          </div>

                          <div className="space-y-3 max-h-96 overflow-y-auto">
                            {transactions.map((transaction, index) => (
                              <div key={transaction.id} className="bg-gray-50 rounded-lg p-4">
                                <div className="grid grid-cols-1 md:grid-cols-6 gap-3 items-center">
                                  <div>
                                    <label className="block text-xs font-medium text-gray-700">Date</label>
                                    <input
                                      type="date"
                                      value={transaction.date}
                                      onChange={(e) => updateTransaction(transaction.id!, 'date', e.target.value)}
                                      className="mt-1 block w-full px-2 py-1 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                                    />
                                  </div>
                                  <div className="md:col-span-2">
                                    <label className="block text-xs font-medium text-gray-700">Description</label>
                                    <input
                                      type="text"
                                      value={transaction.description}
                                      onChange={(e) => updateTransaction(transaction.id!, 'description', e.target.value)}
                                      placeholder="Transaction description"
                                      className="mt-1 block w-full px-2 py-1 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-xs font-medium text-gray-700">Type</label>
                                    <select
                                      value={transaction.type}
                                      onChange={(e) => {
                                        const newType = e.target.value as 'debit' | 'credit';
                                        updateTransaction(transaction.id!, 'type', newType);

                                        // Update amount sign based on account type and new type
                                        const absAmount = Math.abs(transaction.amount);
                                        const accountType = account?.account_type;
                                        // DEBIT increases: Assets, Expenses
                                        // CREDIT increases: Liabilities, Equity, Income
                                        const debitIncreasesBalance = accountType === 'asset' || accountType === 'expense';

                                        let signedAmount: number;
                                        if (debitIncreasesBalance) {
                                          // Debit increases balance: debit = positive, credit = negative
                                          signedAmount = newType === 'debit' ? absAmount : -absAmount;
                                        } else {
                                          // Credit increases balance: credit = positive, debit = negative
                                          signedAmount = newType === 'credit' ? absAmount : -absAmount;
                                        }

                                        updateTransaction(transaction.id!, 'amount', signedAmount);
                                      }}
                                      className="mt-1 block w-full px-2 py-1 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                                    >
                                      {(() => {
                                        const accountType = account?.account_type;
                                        const debitIncreasesBalance = accountType === 'asset' || accountType === 'expense';

                                        if (debitIncreasesBalance) {
                                          return (
                                            <>
                                              <option value="debit">Debit (+)</option>
                                              <option value="credit">Credit (-)</option>
                                            </>
                                          );
                                        } else {
                                          return (
                                            <>
                                              <option value="debit">Debit (-)</option>
                                              <option value="credit">Credit (+)</option>
                                            </>
                                          );
                                        }
                                      })()}
                                    </select>
                                  </div>
                                  <div>
                                    <label className="block text-xs font-medium text-gray-700">Amount</label>
                                    <input
                                      type="number"
                                      step="0.01"
                                      value={Math.abs(transaction.amount) || ''}
                                      onChange={(e) => {
                                        const absValue = Math.abs(parseFloat(e.target.value) || 0);

                                        // Apply sign based on account type and transaction type
                                        const accountType = account?.account_type;
                                        // DEBIT increases: Assets, Expenses
                                        // CREDIT increases: Liabilities, Equity, Income
                                        const debitIncreasesBalance = accountType === 'asset' || accountType === 'expense';

                                        let signedValue: number;
                                        if (debitIncreasesBalance) {
                                          // Debit increases balance: debit = positive, credit = negative
                                          signedValue = transaction.type === 'debit' ? absValue : -absValue;
                                        } else {
                                          // Credit increases balance: credit = positive, debit = negative
                                          signedValue = transaction.type === 'credit' ? absValue : -absValue;
                                        }

                                        updateTransaction(transaction.id!, 'amount', signedValue);
                                      }}
                                      placeholder="0.00"
                                      className="mt-1 block w-full px-2 py-1 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                                    />
                                  </div>
                                  <div className="flex items-end">
                                    {(() => {
                                      const accountType = account?.account_type;
                                      const debitIncreasesBalance = accountType === 'asset' || accountType === 'expense';

                                      if (debitIncreasesBalance) {
                                        // For asset/expense: debit is positive (green up), credit is negative (red down)
                                        return transaction.type === 'debit' ? (
                                          <ArrowUpIcon className="h-5 w-5 text-green-500 mr-2" />
                                        ) : (
                                          <ArrowDownIcon className="h-5 w-5 text-red-500 mr-2" />
                                        );
                                      } else {
                                        // For liability/equity/income: credit is positive (green up), debit is negative (red down)
                                        return transaction.type === 'debit' ? (
                                          <ArrowDownIcon className="h-5 w-5 text-red-500 mr-2" />
                                        ) : (
                                          <ArrowUpIcon className="h-5 w-5 text-green-500 mr-2" />
                                        );
                                      }
                                    })()}
                                    <button
                                      type="button"
                                      onClick={() => removeTransaction(transaction.id!)}
                                      className="p-1 text-red-600 hover:text-red-800"
                                    >
                                      <TrashIcon className="h-4 w-4" />
                                    </button>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Balance Verification */}
                        {closingBalance && (
                          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                            <div className="flex items-center">
                              {isBalanced ? (
                                <CheckCircleIcon className="h-5 w-5 text-green-500 mr-2" />
                              ) : (
                                <ExclamationTriangleIcon className="h-5 w-5 text-yellow-500 mr-2" />
                              )}
                              <div className="flex-1">
                                <p className="text-sm font-medium text-gray-900">
                                  Balance Check
                                </p>
                                <div className="text-sm text-gray-600 mt-1">
                                  <p>Opening: {formatCurrency(parseFloat(openingBalance) || 0, account.currency)}</p>
                                  <p>Calculated: {formatCurrency(runningBalance, account.currency)}</p>
                                  <p>Expected: {formatCurrency(parseFloat(closingBalance) || 0, account.currency)}</p>
                                  {!isBalanced && (
                                    <p className="font-medium text-red-600">
                                      Difference: {formatCurrency(difference, account.currency)}
                                    </p>
                                  )}
                                </div>
                              </div>
                              <div className="text-right">
                                {isBalanced ? (
                                  <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                                    Balanced
                                  </span>
                                ) : (
                                  <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-yellow-100 text-yellow-800">
                                    Out of Balance
                                  </span>
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
                            onClick={() => setCurrentStep('upload')}
                            className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                          >
                            <ArrowLeftIcon className="h-4 w-4 mr-2" />
                            Back to Upload
                          </button>
                          <button
                            type="button"
                            onClick={handleClose}
                            disabled={isSubmitting}
                            className="inline-flex justify-center py-2 px-4 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
                          >
                            Cancel
                          </button>
                          <button
                            type="submit"
                            disabled={isSubmitting || !isBalanced}
                            className="flex-1 inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {isSubmitting ? (
                              <>
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                                Importing...
                              </>
                            ) : (
                              'Import Statement'
                            )}
                          </button>
                        </div>
                      </form>
                    </>
                  )}

                  {currentStep === 'success' && success && (
                    <div className="text-center">
                      <CheckCircleIcon className="mx-auto h-12 w-12 text-green-500 mb-4" />
                      <h3 className="text-lg font-medium text-gray-900 mb-2">
                        Statement Imported Successfully!
                      </h3>
                      <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
                        <div className="text-sm space-y-1">
                          <p><span className="font-medium">Transactions Created:</span> {success.transactions?.length || 0}</p>
                          <p><span className="font-medium">Statement Date:</span> {statementDate}</p>
                          <p><span className="font-medium">New Account Balance:</span> {formatCurrency(parseFloat(closingBalance), account?.currency || 'USD')}</p>
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