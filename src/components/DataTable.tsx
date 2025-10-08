'use client';

import { useState, useEffect, ReactNode } from 'react';
import { MagnifyingGlassIcon, ArrowPathIcon, EllipsisVerticalIcon } from '@heroicons/react/24/outline';

export interface Column<T> {
  key: keyof T | string;
  label: string;
  render?: (item: T) => ReactNode;
  className?: string;
}

export interface Action<T> {
  key: string;
  label: string;
  onClick: (item: T) => void;
  className?: string;
  icon?: ReactNode;
  condition?: (item: T) => boolean;
}

export interface FilterOption {
  key: string;
  label: string;
  options: { value: string; label: string }[];
}

interface DataTableProps<T extends Record<string, any>> {
  title: string;
  data: T[];
  columns: Column<T>[];
  actions?: Action<T>[];
  loading?: boolean;
  error?: string | null;
  onRefresh?: () => void;
  onRowClick?: (item: T, event: React.MouseEvent) => void;
  searchable?: boolean;
  searchFields?: (keyof T)[];
  searchPlaceholder?: string;
  filters?: FilterOption[];
  emptyStateTitle?: string;
  emptyStateDescription?: string;
  emptyStateIcon?: string;
  noResultsTitle?: string;
  noResultsDescription?: string;
  noResultsIcon?: string;
  getItemId: (item: T) => number | string;
  className?: string;
}

export default function DataTable<T extends Record<string, any>>({
  title,
  data,
  columns,
  actions = [],
  loading = false,
  error = null,
  onRefresh,
  onRowClick,
  searchable = true,
  searchFields = [],
  searchPlaceholder = "Search...",
  filters = [],
  emptyStateTitle = "No items found",
  emptyStateDescription = "You don't have any items yet.",
  emptyStateIcon = "📊",
  noResultsTitle = "No matching items",
  noResultsDescription = "Try adjusting your search or filter criteria.",
  noResultsIcon = "🔍",
  getItemId,
  className = ""
}: DataTableProps<T>) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterValues, setFilterValues] = useState<Record<string, string>>({});
  const [openActionMenus, setOpenActionMenus] = useState<Set<number | string>>(new Set());

  const toggleActionMenu = (itemId: number | string) => {
    const newOpenMenus = new Set(openActionMenus);
    if (newOpenMenus.has(itemId)) {
      newOpenMenus.delete(itemId);
    } else {
      newOpenMenus.add(itemId);
    }
    setOpenActionMenus(newOpenMenus);
  };

  const handleRowClick = (item: T, event: React.MouseEvent) => {
    // Don't navigate if clicking on the actions button or menu
    const target = event.target as HTMLElement;
    if (target.closest('[data-action-menu]')) {
      return;
    }
    onRowClick?.(item, event);
  };

  const handleAction = (item: T, action: Action<T>) => {
    // Close the menu
    const itemId = getItemId(item);
    const newOpenMenus = new Set(openActionMenus);
    newOpenMenus.delete(itemId);
    setOpenActionMenus(newOpenMenus);

    // Execute the action
    action.onClick(item);
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

  // Filter data based on search and filters
  const filteredData = data.filter(item => {
    // Search filter
    if (searchable && searchTerm && searchFields.length > 0) {
      const matchesSearch = searchFields.some(field => {
        const value = item[field];
        if (value == null) return false;
        return String(value).toLowerCase().includes(searchTerm.toLowerCase());
      });
      if (!matchesSearch) return false;
    }

    // Custom filters
    for (const filter of filters) {
      const filterValue = filterValues[filter.key];
      if (filterValue && filterValue !== '') {
        const itemValue = item[filter.key as keyof T];
        if (itemValue !== filterValue) return false;
      }
    }

    return true;
  });

  const activeItems = data.filter(item => {
    // Assume items have an 'active' property, otherwise show all
    return !('active' in item) || (item as { active?: number }).active !== 0;
  });

  return (
    <div className={`max-w-7xl mx-auto ${className}`}>
      <div className="bg-white rounded-lg shadow">
        {/* Header */}
        <div className="border-b border-gray-200 p-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
              <p className="text-gray-600 mt-1">
                {activeItems.length} active item{activeItems.length !== 1 ? 's' : ''} found
              </p>
            </div>
            {onRefresh && (
              <button
                onClick={onRefresh}
                className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                <ArrowPathIcon className="h-4 w-4 mr-2" />
                Refresh
              </button>
            )}
          </div>
        </div>

        {/* Filters */}
        {(searchable || filters.length > 0) && (
          <div className="p-6 border-b border-gray-200 bg-gray-50">
            <div className={`grid grid-cols-1 gap-4 ${filters.length === 0 ? 'md:grid-cols-1' : `md:grid-cols-${Math.min(filters.length + 1, 4)}`}`}>
              {/* Search */}
              {searchable && (
                <div className="flex flex-col">
                  <label htmlFor="search-input" className="text-sm font-medium text-gray-700 mb-1">
                    Search
                  </label>
                  <div className="relative">
                    <MagnifyingGlassIcon className="h-5 w-5 absolute left-3 top-3 text-gray-400" />
                    <input
                      id="search-input"
                      type="text"
                      placeholder={searchPlaceholder}
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10 pr-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 w-full"
                    />
                  </div>
                </div>
              )}

              {/* Dynamic Filters */}
              {filters.map((filter) => (
                <div key={filter.key} className="flex flex-col">
                  <label htmlFor={`filter-${filter.key}`} className="text-sm font-medium text-gray-700 mb-1">
                    {filter.label}
                  </label>
                  <select
                    id={`filter-${filter.key}`}
                    value={filterValues[filter.key] || ''}
                    onChange={(e) => setFilterValues(prev => ({ ...prev, [filter.key]: e.target.value }))}
                    className="border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 py-2 px-3"
                  >
                    <option value="">All {filter.label}</option>
                    {filter.options.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Content */}
        <div className="p-6 overflow-visible">
          {loading && (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
              <span className="ml-3 text-gray-600">Loading...</span>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-md mb-6">
              Error: {error}
            </div>
          )}

          {!loading && !error && filteredData.length === 0 && data.length === 0 && (
            <div className="text-center py-12">
              <div className="text-gray-400 text-6xl mb-4">{emptyStateIcon}</div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">{emptyStateTitle}</h3>
              <p className="text-gray-500">{emptyStateDescription}</p>
            </div>
          )}

          {!loading && !error && filteredData.length === 0 && data.length > 0 && (
            <div className="text-center py-12">
              <div className="text-gray-400 text-6xl mb-4">{noResultsIcon}</div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">{noResultsTitle}</h3>
              <p className="text-gray-500">{noResultsDescription}</p>
            </div>
          )}

          {!loading && !error && filteredData.length > 0 && (
            <div className="overflow-x-auto" style={{ overflowY: 'visible' }}>
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    {columns.map((column) => (
                      <th
                        key={String(column.key)}
                        className={`px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider ${column.className || ''}`}
                      >
                        {column.label}
                      </th>
                    ))}
                    {actions.length > 0 && (
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredData.map((item) => {
                    const itemId = getItemId(item);
                    return (
                      <tr
                        key={String(itemId)}
                        className={`hover:bg-gray-50 ${onRowClick ? 'cursor-pointer' : ''}`}
                        onClick={(e) => handleRowClick(item, e)}
                      >
                        {columns.map((column) => (
                          <td key={String(column.key)} className={`px-6 py-4 whitespace-nowrap ${column.className || ''}`}>
                            {column.render ? column.render(item) : String(item[column.key as keyof T] || '')}
                          </td>
                        ))}
                        {actions.length > 0 && (
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                            <div className="relative" data-action-menu>
                              <button
                                onClick={() => toggleActionMenu(itemId)}
                                className="inline-flex items-center p-2 text-gray-400 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 rounded-full"
                              >
                                <EllipsisVerticalIcon className="h-5 w-5" />
                              </button>

                              {openActionMenus.has(itemId) && (
                                <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-md shadow-lg z-50 ring-1 ring-black ring-opacity-5 transform -translate-x-0">
                                  <div className="py-1">
                                    {actions
                                      .filter(action => !action.condition || action.condition(item))
                                      .map((action) => (
                                        <button
                                          key={action.key}
                                          onClick={() => handleAction(item, action)}
                                          className={`block w-full text-left px-4 py-2 text-sm hover:bg-gray-100 ${action.className || 'text-gray-700'}`}
                                        >
                                          <div className="flex items-center">
                                            {action.icon && <span className="mr-2">{action.icon}</span>}
                                            {action.label}
                                          </div>
                                        </button>
                                      ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}