import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Account } from '@/lib/database';

export function useAccountsData() {
  const { currentUser } = useAuth();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAccountsData = async () => {
    if (!currentUser) {
      setAccounts([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Get the Firebase ID token
      const token = await currentUser.getIdToken();

      const response = await fetch('/api/accounts/me', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        setAccounts(data);
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to fetch accounts data');
      }
    } catch (err) {
      setError('Network error occurred');
      console.error('Fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAccountsData();
  }, [currentUser]);

  return {
    accounts,
    loading,
    error,
    refetch: fetchAccountsData
  };
}