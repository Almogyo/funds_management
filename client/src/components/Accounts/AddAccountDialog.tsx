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
  const [card6Digits, setCard6Digits] = useState('');
  const [id, setId] = useState(''); // For Isracard user identification number
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const isCreditCard = ['visaCal', 'max', 'isracard', 'amex'].includes(companyId);
  const requiresCard6Digits = ['isracard', 'amex'].includes(companyId);
  const requiresId = companyId === 'isracard';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // For credit cards, alias is optional - backend will use accountNumber if not provided
      const finalAlias = isCreditCard ? undefined : alias;
      await apiClient.createAccount(
        companyId, 
        accountNumber, 
        finalAlias, 
        username, 
        password,
        requiresCard6Digits ? card6Digits : undefined,
        requiresId ? id : undefined
      );
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
    setCard6Digits('');
    setId('');
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
            label={isCreditCard ? "Card/Account Identifier" : "Account Number"}
            value={accountNumber}
            onChange={(e) => setAccountNumber(e.target.value)}
            margin="normal"
            required
            helperText={isCreditCard 
              ? "Identifier for this card (e.g., last 4 digits or card nickname). This will also be used as the account name. Not used for authentication."
              : "Your bank account number"}
          />

          {!isCreditCard && (
            <TextField
              fullWidth
              label="Alias / Nickname"
              value={alias}
              onChange={(e) => setAlias(e.target.value)}
              margin="normal"
              required
              helperText="Give this account a friendly name"
            />
          )}

          {requiresId && (
            <TextField
              fullWidth
              label="User Identification Number (ID)"
              value={id}
              onChange={(e) => setId(e.target.value)}
              margin="normal"
              required
              autoComplete="off"
              helperText="Your Isracard user identification number"
            />
          )}

          <TextField
            fullWidth
            label={requiresId ? "Username (optional)" : "Username"}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            margin="normal"
            required={!requiresId}
            autoComplete="off"
            helperText={requiresId ? "Optional - ID is used for authentication" : undefined}
          />

          {requiresCard6Digits && (
            <TextField
              fullWidth
              label="Last 6 Digits of Card"
              value={card6Digits}
              onChange={(e) => setCard6Digits(e.target.value.replace(/\D/g, '').slice(0, 6))}
              margin="normal"
              required
              autoComplete="off"
              inputProps={{ maxLength: 6 }}
              helperText="Enter the last 6 digits of your credit card"
            />
          )}

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