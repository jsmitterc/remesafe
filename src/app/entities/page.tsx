'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import DashboardLayout from '@/components/DashboardLayout';
import DataTable, { Column, Action, FilterOption } from '@/components/DataTable';
import {
  UserIcon,
  BuildingOfficeIcon,
  UserGroupIcon,
  FolderIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline';

interface Entity {
  id: number;
  code: string;
  sub_code: string | null;
  name: string | null;
  companyEmail: string | null;
  email: number;
  whatsapp: number;
  timezone: string | null;
  vat: number;
  organization_id: number | null;
  user_id: number | null;
  total_accounts?: number;
  total_balance?: number;
  incomplete_transactions_count?: number;
}

// Since we don't have entity types in the database, we'll determine type from the code prefix or use a default
const determineEntityType = (code: string): 'personal' | 'business' | 'friend' | 'project' => {
  const upperCode = code.toUpperCase();
  if (upperCode.startsWith('PER') || upperCode.startsWith('PERS')) return 'personal';
  if (upperCode.startsWith('BUS') || upperCode.startsWith('COMP')) return 'business';
  if (upperCode.startsWith('FRI') || upperCode.startsWith('FRIEND')) return 'friend';
  if (upperCode.startsWith('PRO') || upperCode.startsWith('PROJ')) return 'project';
  return 'business'; // Default to business
};

const ENTITY_TYPES = {
  personal: { label: 'Personal', icon: UserIcon, color: 'bg-blue-100 text-blue-800' },
  business: { label: 'Business', icon: BuildingOfficeIcon, color: 'bg-green-100 text-green-800' },
  friend: { label: 'Friend', icon: UserGroupIcon, color: 'bg-purple-100 text-purple-800' },
  project: { label: 'Project', icon: FolderIcon, color: 'bg-orange-100 text-orange-800' },
};

export default function EntitiesPage() {
  const router = useRouter();
  const { currentUser } = useAuth();
  const [entities, setEntities] = useState<Entity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchEntities = async () => {
    if (!currentUser) return;

    try {
      setLoading(true);
      setError(null);

      const token = await currentUser.getIdToken();
      const response = await fetch('/api/entities', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch entities');
      }

      const data = await response.json();
      setEntities(data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEntities();
  }, [currentUser]);

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

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const handleRowClick = (entity: Entity, event: React.MouseEvent) => {
    router.push(`/entities/${entity.id}`);
  };

  const handleAction = (entity: Entity, action: string) => {
    switch (action) {
      case 'view':
        router.push(`/entities/${entity.id}`);
        break;
      case 'edit':
        console.log(`Edit entity ${entity.id}`);
        // TODO: Implement edit entity
        break;
      case 'accounts':
        router.push(`/entities/${entity.id}/accounts`);
        break;
      case 'transactions':
        console.log(`View transactions for entity ${entity.id}`);
        // TODO: Implement view transactions
        break;
      case 'reports':
        router.push(`/entities/${entity.id}/reports`);
        break;
      case 'deactivate':
        console.log(`Deactivate entity ${entity.id}`);
        // TODO: Implement deactivate entity
        break;
      default:
        console.log(`Unknown action "${action}" for entity ${entity.id}`);
    }
  };

  const columns: Column<Entity>[] = [
    {
      key: 'name',
      label: 'Entity',
      render: (entity: Entity) => {
        const entityType = determineEntityType(entity.code);
        return (
          <div>
            <div className="flex items-center">
              <div className={`inline-flex items-center justify-center w-8 h-8 rounded-full mr-3 ${ENTITY_TYPES[entityType].color}`}>
                {React.createElement(ENTITY_TYPES[entityType].icon, { className: 'h-4 w-4' })}
              </div>
              <div>
                <div className="text-sm font-medium text-gray-900">{entity.name || 'Unnamed Entity'}</div>
                <div className="text-sm text-gray-500">Code: {entity.code}</div>
                {entity.sub_code && (
                  <div className="text-xs text-gray-400">Sub: {entity.sub_code}</div>
                )}
              </div>
            </div>
          </div>
        );
      }
    },
    {
      key: 'type',
      label: 'Type',
      render: (entity: Entity) => {
        const entityType = determineEntityType(entity.code);
        return (
          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${ENTITY_TYPES[entityType].color}`}>
            {ENTITY_TYPES[entityType].label}
          </span>
        );
      }
    },
    {
      key: 'total_accounts',
      label: 'Accounts',
      render: (entity: Entity) => (
        <div className="text-sm text-gray-900">
          {entity.total_accounts || 0} account{(entity.total_accounts || 0) !== 1 ? 's' : ''}
        </div>
      )
    },
    {
      key: 'total_balance',
      label: 'Total Balance',
      render: (entity: Entity) => (
        <div>
          <div className={`text-sm font-medium ${
            (entity.total_balance || 0) >= 0 ? 'text-green-600' : 'text-red-600'
          }`}>
            {formatCurrency(entity.total_balance || 0, 'USD')}
          </div>
          <div className="text-xs text-gray-500 flex items-center">
            {entity.vat > 0 && (
              <span className="text-xs bg-gray-100 px-1 rounded">VAT: {entity.vat}%</span>
            )}
            {(entity.incomplete_transactions_count || 0) > 0 && (
              <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                <ExclamationTriangleIcon className="h-3 w-3 mr-1" />
                {entity.incomplete_transactions_count} incomplete
              </span>
            )}
          </div>
        </div>
      )
    },
    {
      key: 'companyEmail',
      label: 'Contact',
      render: (entity: Entity) => (
        <div className="text-sm text-gray-500">
          {entity.companyEmail ? (
            <div>{entity.companyEmail}</div>
          ) : (
            <div className="text-gray-400">No email</div>
          )}
          <div className="flex items-center space-x-2 mt-1">
            {entity.email === 1 && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                📧 Email
              </span>
            )}
            {entity.whatsapp === 1 && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                📱 WhatsApp
              </span>
            )}
          </div>
        </div>
      )
    }
  ];

  const actions: Action<Entity>[] = [
    {
      key: 'view',
      label: 'View Details',
      onClick: (entity) => handleAction(entity, 'view'),
      className: 'text-gray-700'
    },
    {
      key: 'edit',
      label: 'Edit Entity',
      onClick: (entity) => handleAction(entity, 'edit'),
      className: 'text-gray-700'
    },
    {
      key: 'accounts',
      label: 'View Accounts',
      onClick: (entity) => handleAction(entity, 'accounts'),
      className: 'text-indigo-600'
    },
    {
      key: 'transactions',
      label: 'View Transactions',
      onClick: (entity) => handleAction(entity, 'transactions'),
      className: 'text-gray-700'
    },
    {
      key: 'reports',
      label: 'View Reports',
      onClick: (entity) => handleAction(entity, 'reports'),
      className: 'text-green-600'
    },
    {
      key: 'deactivate',
      label: 'Deactivate Entity',
      onClick: (entity) => handleAction(entity, 'deactivate'),
      className: 'text-red-600'
    }
  ];

  const filters: FilterOption[] = [
    {
      key: 'email',
      label: 'Email Enabled',
      options: [
        { value: '1', label: 'Enabled' },
        { value: '0', label: 'Disabled' }
      ]
    },
    {
      key: 'whatsapp',
      label: 'WhatsApp Enabled',
      options: [
        { value: '1', label: 'Enabled' },
        { value: '0', label: 'Disabled' }
      ]
    }
  ];

  return (
    <DashboardLayout>
      <DataTable
        title="Entities"
        data={entities}
        columns={columns}
        actions={actions}
        loading={loading}
        error={error}
        onRefresh={fetchEntities}
        onRowClick={handleRowClick}
        searchable={true}
        searchFields={['name', 'code', 'sub_code', 'companyEmail']}
        searchPlaceholder="Search entities by name, code, or email..."
        filters={filters}
        emptyStateTitle="No entities found"
        emptyStateDescription="You don't have any entities set up yet. Create your first entity to start tracking finances."
        emptyStateIcon="🏢"
        noResultsTitle="No matching entities"
        noResultsDescription="Try adjusting your search or filter criteria."
        noResultsIcon="🔍"
        getItemId={(entity) => entity.id}
      />
    </DashboardLayout>
  );
}