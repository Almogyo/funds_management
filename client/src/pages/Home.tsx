import React, { useState, useEffect } from 'react';
import { Box, Grid, Alert } from '@mui/material';
import {
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  AccountBalance as AccountBalanceIcon,
} from '@mui/icons-material';
import { TimeframeFilter } from '../components/Home/TimeframeFilter';
import { SummaryCard } from '../components/Home/SummaryCard';
import { CategoryPieChart } from '../components/Home/CategoryPieChart';
import { TrendChart } from '../components/Home/TrendChart';
import { RecurringPaymentsTable } from '../components/Home/RecurringPaymentsTable';
import { LastUpdateInfo } from '../components/Home/LastUpdateInfo';
import { AccountFilter } from '../components/Home/AccountFilter';
import { apiClient } from '../services/api';
import { getQuickFilterDates, formatDateForApi } from '../utils/dateUtils';
import type {
  TimeframeFilter as TimeframeFilterType,
  AnalyticsSummary,
  CategoryDistribution,
  TrendData,
  RecurringPayment,
  Account,
} from '../types';

export const Home: React.FC = () => {
  const [timeframe, setTimeframe] = useState<TimeframeFilterType>(
    getQuickFilterDates('last_month')
  );
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [categories, setCategories] = useState<CategoryDistribution[]>([]);
  const [trends, setTrends] = useState<TrendData[]>([]);
  const [recurring, setRecurring] = useState<RecurringPayment[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedAccountIds, setSelectedAccountIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchAccounts();
    const interval = setInterval(fetchAccounts, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeframe, selectedAccountIds]);

  const fetchAccounts = async () => {
    try {
      const data = await apiClient.getAccounts();
      setAccounts(data);
    } catch (err) {
      console.error('Failed to fetch accounts:', err);
    }
  };

  const fetchData = async () => {
    setLoading(true);
    setError(null);

    try {
      const startDate = formatDateForApi(timeframe.startDate);
      const endDate = formatDateForApi(timeframe.endDate);

      const accountIdsToFetch = selectedAccountIds.length > 0 ? selectedAccountIds : undefined;

      const [summaryData, categoriesData, trendsData, recurringData] = await Promise.all([
        apiClient.getSummary(startDate, endDate, accountIdsToFetch),
        apiClient.getCategoryDistribution(startDate, endDate, accountIdsToFetch),
        apiClient.getTrends(startDate, endDate, 'month', accountIdsToFetch),
        apiClient.getRecurringPayments(startDate, endDate, accountIdsToFetch),
      ]);

      setSummary(summaryData);
      setCategories(categoriesData);
      setTrends(trendsData);
      setRecurring(recurringData);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to fetch dashboard data');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box>
      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      <Grid container spacing={3}>
        <Grid size={{ xs: 12, md: 3 }}>
          <SummaryCard
            title="Total Income"
            value={summary?.totalIncome || 0}
            icon={<TrendingUpIcon />}
            color="#2e7d32"
          />
        </Grid>
        <Grid size={{ xs: 12, md: 3 }}>
          <SummaryCard
            title="Total Expenses"
            value={Math.abs(summary?.totalExpenses || 0)}
            icon={<TrendingDownIcon />}
            color="#d32f2f"
          />
        </Grid>
        <Grid size={{ xs: 12, md: 3 }}>
          <SummaryCard
            title="Net Income"
            value={summary?.netIncome || 0}
            icon={<AccountBalanceIcon />}
            color="#1976d2"
          />
        </Grid>
        <Grid size={{ xs: 12, md: 3 }}>
          <LastUpdateInfo accounts={accounts} />
        </Grid>

        <Grid size={{ xs: 12, md: 6 }}>
          <TimeframeFilter value={timeframe} onChange={setTimeframe} />
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <AccountFilter
            accounts={accounts}
            selectedAccountIds={selectedAccountIds}
            onChange={setSelectedAccountIds}
          />
        </Grid>

        <Grid size={{ xs: 12, md: 6 }}>
          <CategoryPieChart data={categories} loading={loading} />
        </Grid>

        <Grid size={{ xs: 12, md: 6 }}>
          <TrendChart data={trends} loading={loading} />
        </Grid>

        <Grid size={{ xs: 12 }}>
          <RecurringPaymentsTable data={recurring} loading={loading} />
        </Grid>
      </Grid>
    </Box>
  );
};