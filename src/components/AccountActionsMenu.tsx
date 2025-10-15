'use client';

import { useState, useEffect, useRef } from 'react';
import { EllipsisVerticalIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import { Account } from '@/lib/database';

interface AccountActionsMenuProps {
  account: Account;
  onAction: (accountId: number, action: string) => void;
}

export default function AccountActionsMenu({ account, onAction }: AccountActionsMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const toggleMenu = () => {
    setIsOpen(!isOpen);
  };

  const handleAction = (action: string) => {
    setIsOpen(false);
    onAction(account.id, action);
  };

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  return (
    <div className="relative" data-action-menu ref={menuRef}>
      <button
        onClick={toggleMenu}
        className="inline-flex items-center p-2 text-gray-400 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 rounded-full"
      >
        <EllipsisVerticalIcon className="h-5 w-5" />
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-md shadow-lg z-50 ring-1 ring-black ring-opacity-5 transform -translate-x-0">
          <div className="py-1">
            <button
              onClick={() => handleAction('view')}
              className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
            >
              View Details
            </button>
            <button
              onClick={() => handleAction('edit')}
              className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
            >
              Edit Account
            </button>
            <button
              onClick={() => handleAction('transactions')}
              className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
            >
              View Transactions
            </button>
            <button
              onClick={() => handleAction('reconcile')}
              className="block w-full text-left px-4 py-2 text-sm text-indigo-600 hover:bg-indigo-50"
            >
              Reconcile Account
            </button>
            <button
              onClick={() => handleAction('import-statement')}
              className="block w-full text-left px-4 py-2 text-sm text-green-600 hover:bg-green-50"
            >
              Import Statement
            </button>
            {(account.incomplete_transactions_count || 0) > 0 && (
              <button
                onClick={() => handleAction('assign-transactions')}
                className="block w-full text-left px-4 py-2 text-sm text-yellow-600 hover:bg-yellow-50 flex items-center"
              >
                <ExclamationTriangleIcon className="h-4 w-4 mr-2" />
                Assign Transactions ({account.incomplete_transactions_count})
              </button>
            )}
            <button
              onClick={() => handleAction('statements')}
              className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
            >
              Download Statement
            </button>
            <div className="border-t border-gray-100">
              <button
                onClick={() => handleAction('deactivate')}
                className="block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50"
              >
                Deactivate Account
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
