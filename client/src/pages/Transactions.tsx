import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Autocomplete,
  TextField,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Chip,
  CircularProgress,
  Alert,
  Stack,
} from '@mui/material';
import { apiClient } from '../services/api';
import * as categoriesApi from '../services/categories';
import TransactionCategoryDialog from '../components/Transactions/TransactionCategoryDialog';
import { formatDate, formatCurrency, getQuickFilterDates, formatDateForApi } from '../utils/dateUtils';
import type { Transaction, TimeframeFilter as TimeframeFilterType } from '../types';
import { useLocation, useNavigate } from 'react-router-dom';

export const Transactions: React.FC = () => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [timeframe, setTimeframe] = useState<TimeframeFilterType>(getQuickFilterDates('last_month'));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);

  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);

  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    // parse query params for categories
    const q = new URLSearchParams(location.search);
    const cats = q.get('categories');
    if (cats) {
      setSelectedCategories(cats.split(','));
    } else {
      setSelectedCategories([]);
    }
  }, [location.search]);

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCategories, timeframe]);

  const fetchData = async () => {
    setLoading(true);
    setError(null);

    try {
      const startDate = formatDateForApi(timeframe.startDate);
      const endDate = formatDateForApi(timeframe.endDate);
      
      const [transactionsData, accountsData, categoriesData] = await Promise.all([
        apiClient.getTransactions({
          startDate,
          endDate,
          categories: selectedCategories.length ? selectedCategories : undefined,
        }),
        apiClient.getAccounts(),
        (await import('../services/categories')).getCategories(),
      ]);
      setTransactions(transactionsData);
      setAccounts(accountsData);
      setCategories(categoriesData);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to fetch transactions');
    } finally {
      setLoading(false);
    }
  };

  const handleCategoryChange = (selected: any[]) => {
    const ids = selected.map((s) => s.id);
    setSelectedCategories(ids);
    // update query param
    const qs = new URLSearchParams(location.search);
    if (ids.length) {
      qs.set('categories', ids.join(','));
    } else {
      qs.delete('categories');
    }
    navigate({ pathname: '/transactions', search: qs.toString() }, { replace: true });
  };

  const getAccountName = (accountId: string): string => {
    const account = accounts.find((a) => a.id === accountId);
    return account?.alias || 'Unknown';
  };

  const handleChangePage = (_event: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const getCategoryColor = (category: string): 'default' | 'primary' | 'secondary' | 'success' | 'error' | 'warning' => {
    if (category === 'Unknown') return 'default';
    return 'primary';
  };

  const getAmountColor = (amount: number): string => {
    return amount >= 0 ? '#2e7d32' : '#d32f2f';
  };

  const handleCategoryClick = (transaction: Transaction) => {
    setSelectedTransaction(transaction);
    setCategoryDialogOpen(true);
  };

  const handleAssignExistingCategory = async (transactionId: string, categoryId: string) => {
    try {
      await apiClient.updateTransactionCategory(transactionId, categoryId);
      setCategoryDialogOpen(false);
      setSelectedTransaction(null);
      // Refresh transactions to show updated category
      fetchData();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to assign category');
    }
  };

  const handleCreateAndAssignCategory = async (
    _transactionId: string,
    categoryName: string,
    keyword: string
  ) => {
    try {
      // Create new category with keyword
      // This will trigger automatic re-categorization in the background
      await categoriesApi.createCategory(categoryName, [keyword]);
      
      // Close dialog and refresh to show updated categories
      setCategoryDialogOpen(false);
      setSelectedTransaction(null);
      
      // Wait a bit for background re-categorization to complete, then refresh
      setTimeout(() => {
        fetchData();
      }, 500);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to create category');
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
        <CircularProgress />
      </Box>
    );
  }

  const paginatedTransactions = transactions.slice(
    page * rowsPerPage,
    page * rowsPerPage + rowsPerPage
  );

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" fontWeight={600}>
          Transactions
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Total: {transactions.length} transactions
        </Typography>
      </Box>

      <Stack direction="row" spacing={2} sx={{ mb: 2, alignItems: 'flex-start' }}>
        <Stack direction="row" spacing={1} sx={{ flex: 1 }}>
          <TextField
            type="date"
            label="Start Date"
            size="small"
            value={formatDateForApi(timeframe.startDate)}
            onChange={(e) => {
              const newDate = new Date(e.target.value);
              setTimeframe({
                ...timeframe,
                startDate: newDate,
              });
            }}
            InputLabelProps={{ shrink: true }}
            sx={{ flex: 1 }}
          />
          <TextField
            type="date"
            label="End Date"
            size="small"
            value={formatDateForApi(timeframe.endDate)}
            onChange={(e) => {
              const newDate = new Date(e.target.value);
              setTimeframe({
                ...timeframe,
                endDate: newDate,
              });
            }}
            InputLabelProps={{ shrink: true }}
            sx={{ flex: 1 }}
          />
        </Stack>
        <Autocomplete
          multiple
          options={categories}
          getOptionLabel={(o) => o.name}
          value={categories.filter((c) => selectedCategories.includes(c.id))}
          onChange={(_e, value) => handleCategoryChange(value)}
          filterSelectedOptions
          renderInput={(params) => <TextField {...params} label="Filter by categories" size="small" />}
          sx={{ minWidth: 300 }}
        />
      </Stack>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      <Card>
        <CardContent>
          {transactions.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <Typography variant="body1" color="text.secondary">
                No transactions found. Scrape your accounts to import transaction data.
              </Typography>
            </Box>
          ) : (
            <>
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Date</TableCell>
                      <TableCell>Account</TableCell>
                      <TableCell>Description</TableCell>
                      <TableCell>Category</TableCell>
                      <TableCell align="right">Amount</TableCell>
                      <TableCell>Status</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {paginatedTransactions.map((transaction) => (
                      <TableRow key={transaction.id} hover>
                        <TableCell>
                          <Typography variant="body2">
                            {formatDate(transaction.date)}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" fontWeight={500}>
                            {getAccountName(transaction.accountId)}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" sx={{ maxWidth: 300 }}>
                            {transaction.description}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          {(() => {
                            // Show only the main category
                            const mainCategory = transaction.categories?.find(cat => cat.isMain) ||
                              (transaction.mainCategoryId 
                                ? transaction.categories?.find(cat => cat.categoryId === transaction.mainCategoryId)
                                : null);
                            
                            const categoryName = mainCategory?.categoryName || 'Unknown';
                            
                            return (
                              <Chip
                                label={categoryName}
                                size="small"
                                color={getCategoryColor(categoryName)}
                                onClick={() => handleCategoryClick(transaction)}
                                sx={{ cursor: 'pointer' }}
                                variant="outlined"
                              />
                            );
                          })()}
                        </TableCell>
                        <TableCell align="right">
                          <Typography
                            variant="body2"
                            fontWeight={600}
                            sx={{ color: getAmountColor(transaction.amount) }}
                          >
                            {transaction.amount >= 0 ? '+' : ''}
                            {formatCurrency(transaction.amount)} {transaction.currency}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={transaction.status}
                            size="small"
                            color={transaction.status === 'completed' ? 'success' : 'warning'}
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
              <TablePagination
                rowsPerPageOptions={[10, 25, 50, 100]}
                component="div"
                count={transactions.length}
                rowsPerPage={rowsPerPage}
                page={page}
                onPageChange={handleChangePage}
                onRowsPerPageChange={handleChangeRowsPerPage}
              />
            </>
          )}
        </CardContent>
      </Card>

      <TransactionCategoryDialog
        open={categoryDialogOpen}
        transaction={
          selectedTransaction
            ? {
                id: selectedTransaction.id,
                description: selectedTransaction.description,
                category: null,
              }
            : null
        }
        categories={categories}
        onClose={() => {
          setCategoryDialogOpen(false);
          setSelectedTransaction(null);
        }}
        onAssignExisting={handleAssignExistingCategory}
        onCreateAndAssign={handleCreateAndAssignCategory}
      />
    </Box>
  );
};