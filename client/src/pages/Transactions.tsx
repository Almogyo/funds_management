import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
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
} from '@mui/material';
import { apiClient } from '../services/api';
import { formatDate, formatCurrency } from '../utils/dateUtils';
import type { Transaction } from '../types';

export const Transactions: React.FC = () => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    setError(null);

    try {
      const [transactionsData, accountsData] = await Promise.all([
        apiClient.getTransactions(),
        apiClient.getAccounts(),
      ]);
      setTransactions(transactionsData);
      setAccounts(accountsData);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to fetch transactions');
    } finally {
      setLoading(false);
    }
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
                          <Chip
                            label={transaction.category || 'Unknown'}
                            size="small"
                            color={getCategoryColor(transaction.category || 'Unknown')}
                          />
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
    </Box>
  );
};