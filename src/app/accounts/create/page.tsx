'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import DashboardLayout from '@/components/DashboardLayout';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';

interface Entity {
  id: number;
  code: string;
  name: string | null;
}

export default function CreateAccountPage() {
  const router = useRouter();
  const { currentUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [entities, setEntities] = useState<Entity[]>([]);
  const [loadingEntities, setLoadingEntities] = useState(true);
  const [existingAccounts, setExistingAccounts] = useState<Array<{ code: string; account_type: string }>>([]);

  const [formData, setFormData] = useState({
    code: '',
    alias: '',
    category: '',
    account_type: 'asset',
    currency: 'USD',
    balance: '0',
    company: '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  // Fetch entities for the dropdown
  useEffect(() => {
    const fetchEntities = async () => {
      if (!currentUser) return;

      try {
        const token = await currentUser.getIdToken();
        const response = await fetch('/api/entities', {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });

        if (response.ok) {
          const data = await response.json();
          setEntities(data || []);
        }
      } catch (error) {
        console.error('Failed to fetch entities:', error);
      } finally {
        setLoadingEntities(false);
      }
    };

    fetchEntities();
  }, [currentUser]);

  // Fetch existing accounts when entity is selected
  useEffect(() => {
    const fetchAccounts = async () => {
      if (!currentUser || !formData.company) {
        setExistingAccounts([]);
        return;
      }

      try {
        const token = await currentUser.getIdToken();
        const response = await fetch(`/api/accounts?entity=${formData.company}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });

        if (response.ok) {
          const data = await response.json();
          setExistingAccounts(data.map((acc: any) => ({
            code: acc.code,
            account_type: acc.account_type
          })));
        }
      } catch (error) {
        console.error('Failed to fetch accounts:', error);
      }
    };

    fetchAccounts();
  }, [currentUser, formData.company]);

  const generateAccountCode = (category: string) => {
    if (!category) return '';

    // Category prefixes
    const prefixes: Record<string, string> = {
      asset: 'AST',
      liability: 'LIA',
      equity: 'EQU',
      income: 'INC',
      expense: 'EXP',
    };

    const prefix = prefixes[category] || 'ACC';

    // Get existing codes with the same prefix
    const existingCodes = existingAccounts
      .map(account => account.code)
      .filter(code => code.startsWith(prefix))
      .map(code => parseInt(code.substring(prefix.length)))
      .filter(num => !isNaN(num))
      .sort((a, b) => b - a);

    // Get the next available number
    const nextNumber = existingCodes.length > 0 ? existingCodes[0] + 1 : 1;

    return `${prefix}${nextNumber.toString().padStart(3, '0')}`;
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;

    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }

    // Auto-generate code when account_type or category changes
    if ((name === 'account_type' || name === 'category') && formData.company) {
      const generatedCode = generateAccountCode(value);
      setFormData(prev => ({ ...prev, [name]: value, code: generatedCode }));
    } else if (name === 'company') {
      // When company changes, regenerate code if account_type is set
      setFormData(prev => {
        const newData = { ...prev, [name]: value };
        if (prev.account_type) {
          newData.code = generateAccountCode(prev.account_type);
        }
        return newData;
      });
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.code.trim()) {
      newErrors.code = 'Account code is required';
    }
    if (!formData.alias.trim()) {
      newErrors.alias = 'Account name is required';
    }
    if (!formData.category.trim()) {
      newErrors.category = 'Category is required';
    }
    if (!formData.company) {
      newErrors.company = 'Entity is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    if (!currentUser) {
      alert('You must be logged in to create an account');
      return;
    }

    setLoading(true);

    try {
      const token = await currentUser.getIdToken();

      const response = await fetch('/api/accounts', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          code: formData.code.trim(),
          alias: formData.alias.trim(),
          category: formData.category,
          account_type: formData.account_type,
          currency: formData.currency,
          balance: parseFloat(formData.balance) || 0,
          active: 1,
          company: parseInt(formData.company),
        }),
      });

      if (response.ok) {
        const data = await response.json();
        alert('Account created successfully!');
        router.push('/accounts');
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create account');
      }
    } catch (error) {
      console.error('Failed to create account:', error);
      alert(error instanceof Error ? error.message : 'Failed to create account');
    } finally {
      setLoading(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="max-w-3xl mx-auto">
        <div className="bg-white rounded-lg shadow">
          {/* Header */}
          <div className="border-b border-gray-200 p-6">
            <div className="flex items-center">
              <button
                onClick={() => router.push('/accounts')}
                className="mr-4 text-gray-600 hover:text-gray-900"
              >
                <ArrowLeftIcon className="h-5 w-5" />
              </button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Create New Account</h1>
                <p className="text-gray-600 mt-1">Add a new account to your ledger</p>
              </div>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-6">
            <div className="space-y-6">
              {/* Entity Selection */}
              <div>
                <label htmlFor="company" className="block text-sm font-medium text-gray-700 mb-1">
                  Entity <span className="text-red-500">*</span>
                </label>
                <select
                  id="company"
                  name="company"
                  value={formData.company}
                  onChange={handleChange}
                  disabled={loadingEntities}
                  className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                    errors.company ? 'border-red-500' : 'border-gray-300'
                  }`}
                >
                  <option value="">Select an entity...</option>
                  {entities.map((entity) => (
                    <option key={entity.id} value={entity.id}>
                      {entity.name || entity.code} ({entity.code})
                    </option>
                  ))}
                </select>
                {errors.company && (
                  <p className="mt-1 text-sm text-red-500">{errors.company}</p>
                )}
              </div>

              {/* Account Code */}
              <div>
                <label htmlFor="code" className="block text-sm font-medium text-gray-700 mb-1">
                  Account Code <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  id="code"
                  name="code"
                  value={formData.code}
                  readOnly
                  placeholder="Select entity and account type to generate..."
                  className={`w-full px-3 py-2 border rounded-md bg-gray-50 text-gray-700 ${
                    errors.code ? 'border-red-500' : 'border-gray-300'
                  }`}
                />
                {errors.code && (
                  <p className="mt-1 text-sm text-red-500">{errors.code}</p>
                )}
                <p className="mt-1 text-sm text-gray-500">Auto-generated based on entity and account type</p>
              </div>

              {/* Account Name/Alias */}
              <div>
                <label htmlFor="alias" className="block text-sm font-medium text-gray-700 mb-1">
                  Account Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  id="alias"
                  name="alias"
                  value={formData.alias}
                  onChange={handleChange}
                  placeholder="e.g., Cash on Hand"
                  className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                    errors.alias ? 'border-red-500' : 'border-gray-300'
                  }`}
                />
                {errors.alias && (
                  <p className="mt-1 text-sm text-red-500">{errors.alias}</p>
                )}
              </div>

              {/* Category */}
              <div>
                <label htmlFor="category" className="block text-sm font-medium text-gray-700 mb-1">
                  Category <span className="text-red-500">*</span>
                </label>
                <select
                  id="category"
                  name="category"
                  value={formData.category}
                  onChange={handleChange}
                  className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                    errors.category ? 'border-red-500' : 'border-gray-300'
                  }`}
                >
                  <option value="">Select a category...</option>
                  <option value="asset">Asset</option>
                  <option value="liability">Liability</option>
                  <option value="equity">Equity</option>
                  <option value="income">Income</option>
                  <option value="expense">Expense</option>
                </select>
                {errors.category && (
                  <p className="mt-1 text-sm text-red-500">{errors.category}</p>
                )}
              </div>

              {/* Account Type */}
              <div>
                <label htmlFor="account_type" className="block text-sm font-medium text-gray-700 mb-1">
                  Account Type
                </label>
                <select
                  id="account_type"
                  name="account_type"
                  value={formData.account_type}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="asset">Asset</option>
                  <option value="liability">Liability</option>
                  <option value="equity">Equity</option>
                  <option value="income">Income</option>
                  <option value="expense">Expense</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Currency */}
                <div>
                  <label htmlFor="currency" className="block text-sm font-medium text-gray-700 mb-1">
                    Currency
                  </label>
                  <input
                    type="text"
                    id="currency"
                    name="currency"
                    value={formData.currency}
                    onChange={handleChange}
                    placeholder="USD"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                {/* Opening Balance */}
                <div>
                  <label htmlFor="balance" className="block text-sm font-medium text-gray-700 mb-1">
                    Opening Balance
                  </label>
                  <input
                    type="number"
                    id="balance"
                    name="balance"
                    value={formData.balance}
                    onChange={handleChange}
                    step="0.01"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>
            </div>

            {/* Form Actions */}
            <div className="mt-8 flex justify-end space-x-3 border-t border-gray-200 pt-6">
              <button
                type="button"
                onClick={() => router.push('/accounts')}
                disabled={loading}
                className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
              >
                {loading ? 'Creating...' : 'Create Account'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </DashboardLayout>
  );
}
