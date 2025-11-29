import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  MenuItem,
  Alert,
  CircularProgress,
  Box,
} from '@mui/material';
import type { CompanyId } from '../../types';
import { apiClient } from '../../services/api';
import { companyOptions } from '../../utils/companyIcons';

interface AddAccountDialogProps {
  open: boolean;
  onClose: () => void;
  onAccountAdded: () => void;
}

export const AddAccountDialog: React.FC<AddAccountDialogProps> = ({
  open,
  onClose,
  onAccountAdded,
}) => {
  const [companyId, setCompanyId] = useState<CompanyId>('hapoalim');
  const [accountNumber, setAccountNumber] = useState('');
  const [alias, setAlias] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await apiClient.createAccount(companyId, accountNumber, alias, username, password);
      onAccountAdded();
      handleClose();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to add account');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setCompanyId('hapoalim');
    setAccountNumber('');
    setAlias('');
    setUsername('');
    setPassword('');
    setError('');
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>Add New Account</DialogTitle>
      <form onSubmit={handleSubmit}>
        <DialogContent>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          <TextField
            select
            fullWidth
            label="Financial Institution"
            value={companyId}
            onChange={(e) => setCompanyId(e.target.value as CompanyId)}
            margin="normal"
            required
          >
            {companyOptions.map((option) => (
              <MenuItem key={option.value} value={option.value}>
                {option.label} ({option.type === 'bank' ? 'Bank' : 'Credit Card'})
              </MenuItem>
            ))}
          </TextField>

          <TextField
            fullWidth
            label="Account Number"
            value={accountNumber}
            onChange={(e) => setAccountNumber(e.target.value)}
            margin="normal"
            required
          />

          <TextField
            fullWidth
            label="Alias / Nickname"
            value={alias}
            onChange={(e) => setAlias(e.target.value)}
            margin="normal"
            required
            helperText="Give this account a friendly name"
          />

          <TextField
            fullWidth
            label="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            margin="normal"
            required
            autoComplete="off"
          />

          <TextField
            fullWidth
            label="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            margin="normal"
            required
            autoComplete="new-password"
          />

          <Box sx={{ mt: 1 }}>
            <Alert severity="info">
              Your credentials are encrypted and stored securely. They are only used to fetch your
              transaction data.
            </Alert>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose} disabled={loading}>
            Cancel
          </Button>
          <Button type="submit" variant="contained" disabled={loading}>
            {loading ? <CircularProgress size={24} /> : 'Add Account'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
};