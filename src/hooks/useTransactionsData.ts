import { useState, useEffect, useCallback } from 'react';
import { Transaction } from '@/lib/database';

export function useTransactionsData(accountId: number | null) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);

  const fetchTransactions = useCallback(async (reset: boolean = false) => {
    if (!accountId) {
      setTransactions([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const offset = reset ? 0 : transactions.length;
      const limit = 50;

      const response = await fetch(`/api/transactions/${accountId}?limit=${limit}&offset=${offset}`);

      if (response.ok) {
        const data = await response.json();

        if (reset) {
          setTransactions(data);
        } else {
          setTransactions(prev => [...prev, ...data]);
        }

        // If we received fewer records than requested, we've reached the end
        setHasMore(data.length === limit);
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to fetch transactions data');
      }
    } catch (err) {
      setError('Network error occurred');
      console.error('Fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [accountId, transactions.length]);

  const refreshTransactions = useCallback(() => {
    if (accountId) {
      setTransactions([]);
      setHasMore(true);
      fetchTransactions(true);
    }
  }, [accountId, fetchTransactions]);

  const loadMore = useCallback(() => {
    if (!loading && hasMore) {
      fetchTransactions(false);
    }
  }, [fetchTransactions, loading, hasMore]);

  useEffect(() => {
    if (accountId) {
      setTransactions([]);
      setHasMore(true);
      fetchTransactions(true);
    } else {
      setTransactions([]);
      setError(null);
      setHasMore(true);
    }
  }, [accountId]); // Only depend on accountId, not fetchTransactions to avoid infinite loop

  return {
    transactions,
    loading,
    error,
    hasMore,
    refreshTransactions,
    loadMore
  };
}