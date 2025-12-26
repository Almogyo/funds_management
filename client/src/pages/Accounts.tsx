import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Chip,
  Alert,
  CircularProgress,
} from '@mui/material';
import { Add as AddIcon, Edit as EditIcon, Delete as DeleteIcon, Sync as SyncIcon, Refresh as RefreshIcon } from '@mui/icons-material';
import type { Account } from '../types';
import { apiClient } from '../services/api';
import { AddAccountDialog } from '../components/Accounts/AddAccountDialog';
import { EditAccountDialog } from '../components/Accounts/EditAccountDialog';
import { DeleteAccountDialog } from '../components/Accounts/DeleteAccountDialog';
import { ScrapeDialog } from '../components/Accounts/ScrapeDialog';
import { getCompanyIcon, getCompanyName, getAccountType } from '../utils/companyIcons';
import { formatDate, formatDateTime } from '../utils/dateUtils';

export const Accounts: React.FC = () => {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [scrapeDialogOpen, setScrapeDialogOpen] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);
  const [scrapeAccountIds, setScrapeAccountIds] = useState<string[] | undefined>(undefined);

  useEffect(() => {
    fetchAccounts();
  }, []);

  const fetchAccounts = async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await apiClient.getAccounts();
      const accountsWithType = data.map((account) => ({
        ...account,
        accountType: getAccountType(account.companyId),
      }));
      setAccounts(accountsWithType);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to fetch accounts');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (account: Account) => {
    setSelectedAccount(account);
    setEditDialogOpen(true);
  };

  const handleDelete = (account: Account) => {
    setSelectedAccount(account);
    setDeleteDialogOpen(true);
  };

  const handleScrapeAccount = (account: Account) => {
    setScrapeAccountIds([account.id]);
    setScrapeDialogOpen(true);
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" fontWeight={600}>
          Accounts
        </Typography>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button
            variant="outlined"
            startIcon={<SyncIcon />}
            onClick={() => setScrapeDialogOpen(true)}
            disabled={accounts.length === 0}
          >
            Scrape Now
          </Button>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setAddDialogOpen(true)}
          >
            Add Account
          </Button>
        </Box>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      <Card>
        <CardContent>
          {accounts.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <Typography variant="body1" color="text.secondary">
                No accounts configured yet. Add your first account to get started!
              </Typography>
            </Box>
          ) : (
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Type</TableCell>
                    <TableCell>Institution</TableCell>
                    <TableCell>Alias</TableCell>
                    <TableCell>Account Number</TableCell>
                    {accounts.some(a => a.accountType === 'credit' && a.card6Digits) && (
                      <TableCell>Card (Last 6)</TableCell>
                    )}
                    <TableCell>Status</TableCell>
                    <TableCell>Last Scraped</TableCell>
                    <TableCell>Created</TableCell>
                    <TableCell>Updated</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {accounts.map((account) => (
                    <TableRow key={account.id}>
                      <TableCell>{getCompanyIcon(account.companyId, account.accountType)}</TableCell>
                      <TableCell>{getCompanyName(account.companyId)}</TableCell>
                      <TableCell>{account.alias}</TableCell>
                      <TableCell>{account.accountNumber}</TableCell>
                      {accounts.some(a => a.accountType === 'credit' && a.card6Digits) && (
                        <TableCell>
                          {account.accountType === 'credit' && account.card6Digits 
                            ? `****${account.card6Digits}` 
                            : '-'}
                        </TableCell>
                      )}
                      <TableCell>
                        <Chip
                          label={account.active ? 'Active' : 'Inactive'}
                          color={account.active ? 'success' : 'default'}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>
                        {account.lastScrapedAt ? formatDate(account.lastScrapedAt) : 'Never'}
                      </TableCell>
                      <TableCell>
                        {account.createdAt ? formatDateTime(account.createdAt) : '-'}
                      </TableCell>
                      <TableCell>
                        {account.updatedAt ? formatDateTime(account.updatedAt) : '-'}
                      </TableCell>
                      <TableCell align="right">
                        <IconButton
                          size="small"
                          onClick={() => handleScrapeAccount(account)}
                          title="Scrape this account"
                          color="primary"
                        >
                          <RefreshIcon />
                        </IconButton>
                        <IconButton size="small" onClick={() => handleEdit(account)} title="Edit account">
                          <EditIcon />
                        </IconButton>
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => handleDelete(account)}
                          title="Delete account"
                        >
                          <DeleteIcon />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </CardContent>
      </Card>

      <AddAccountDialog
        open={addDialogOpen}
        onClose={() => setAddDialogOpen(false)}
        onAccountAdded={fetchAccounts}
      />

      <EditAccountDialog
        open={editDialogOpen}
        account={selectedAccount}
        onClose={() => {
          setEditDialogOpen(false);
          setSelectedAccount(null);
        }}
        onAccountUpdated={fetchAccounts}
      />

      <DeleteAccountDialog
        open={deleteDialogOpen}
        account={selectedAccount}
        onClose={() => {
          setDeleteDialogOpen(false);
          setSelectedAccount(null);
        }}
        onAccountDeleted={fetchAccounts}
      />

      <ScrapeDialog
        open={scrapeDialogOpen}
        onClose={() => {
          setScrapeDialogOpen(false);
          setScrapeAccountIds(undefined);
        }}
        onScrapeComplete={fetchAccounts}
        accountIds={scrapeAccountIds}
      />
    </Box>
  );
};