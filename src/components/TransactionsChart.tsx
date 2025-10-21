'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from 'recharts';

interface TransactionStat {
  date: string;
  count: number;
  totalAmount: number;
}

interface TransactionsChartProps {
  accountId?: number;
  entityId?: number;
  onDateClick?: (date: string) => void;
  selectedDate?: string | null;
}

export default function TransactionsChart({ accountId, entityId, onDateClick, selectedDate }: TransactionsChartProps) {
  const { currentUser } = useAuth();
  const [stats, setStats] = useState<TransactionStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<number>(30); // Default to 30 days
  const [viewMode, setViewMode] = useState<'count' | 'amount'>('count');

  useEffect(() => {
    const fetchStats = async () => {
      if (!currentUser) return;

      setLoading(true);
      try {
        const token = await currentUser.getIdToken();
        const params = new URLSearchParams({
          days: timeRange.toString(),
        });

        if (accountId) {
          params.append('accountId', accountId.toString());
        }

        if (entityId) {
          params.append('entity', entityId.toString());
        }

        const response = await fetch(`/api/transactions/stats?${params}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });

        if (response.ok) {
          const data = await response.json();
          setStats(data);
        }
      } catch (error) {
        console.error('Failed to fetch transaction stats:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [currentUser, timeRange, accountId, entityId]);

  // Format date for display
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Transaction Activity</h2>
          <p className="text-sm text-gray-500 mt-1">
            Overview of transaction {viewMode === 'count' ? 'volume' : 'amounts'} over time
            {onDateClick && <span className="text-indigo-600"> • Click bars to filter by date</span>}
          </p>
        </div>

        <div className="flex space-x-2">
          {/* View Mode Toggle */}
          <div className="flex border border-gray-300 rounded-md">
            <button
              onClick={() => setViewMode('count')}
              className={`px-3 py-1.5 text-sm font-medium ${
                viewMode === 'count'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-50'
              } rounded-l-md`}
            >
              Count
            </button>
            <button
              onClick={() => setViewMode('amount')}
              className={`px-3 py-1.5 text-sm font-medium ${
                viewMode === 'amount'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-50'
              } rounded-r-md`}
            >
              Amount
            </button>
          </div>

          {/* Time Range Selector */}
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(parseInt(e.target.value))}
            className="px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
            <option value={180}>Last 6 months</option>
            <option value={365}>Last year</option>
          </select>
        </div>
      </div>

      {/* Chart */}
      {stats.length > 0 ? (
        <ResponsiveContainer width="100%" height={300}>
          <BarChart
            data={stats.map(stat => ({
              ...stat,
              displayDate: formatDate(stat.date),
            }))}
            margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
            onClick={(data) => {
              if (data && data.activeIndex !== undefined) {
                const clickedDate = stats[parseInt(data.activeIndex)].date;
                if (onDateClick) {
                  onDateClick(clickedDate);
                }
              }
            }}
          >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="displayDate"
              tick={{ fontSize: 12 }}
              interval={Math.floor(stats.length / 10) || 0}
            />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip
              formatter={(value: number) =>
                viewMode === 'amount' ? formatCurrency(value) : value
              }
              labelFormatter={(label) => `Date: ${label}`}
              cursor={{ fill: 'rgba(79, 70, 229, 0.1)' }}
            />
            <Legend />
            <Bar
              dataKey={viewMode === 'count' ? 'count' : 'totalAmount'}
              name={viewMode === 'count' ? 'Transaction Count' : 'Total Amount'}
              radius={[4, 4, 0, 0]}
              cursor="pointer"
            >
              {stats.map((stat, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={stat.date === selectedDate ? '#818cf8' : '#4f46e5'}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      ) : (
        <div className="h-64 flex items-center justify-center text-gray-500">
          No transaction data available for this period
        </div>
      )}

      {/* Summary Stats */}
      {stats.length > 0 && (
        <div className="mt-6 grid grid-cols-3 gap-4">
          <div className="bg-gray-50 rounded-lg p-4">
            <p className="text-sm text-gray-600">Total Transactions</p>
            <p className="text-2xl font-semibold text-gray-900 mt-1">
              {stats.reduce((sum, stat) => sum + stat.count, 0)}
            </p>
          </div>
          <div className="bg-gray-50 rounded-lg p-4">
            <p className="text-sm text-gray-600">Total Amount</p>
            <p className="text-2xl font-semibold text-gray-900 mt-1">
              {formatCurrency(stats.reduce((sum, stat) => sum + stat.totalAmount, 0))}
            </p>
          </div>
          <div className="bg-gray-50 rounded-lg p-4">
            <p className="text-sm text-gray-600">Daily Average</p>
            <p className="text-2xl font-semibold text-gray-900 mt-1">
              {Math.round(stats.reduce((sum, stat) => sum + stat.count, 0) / stats.length)}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
