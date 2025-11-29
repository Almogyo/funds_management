
import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Alert,
  CircularProgress,
  FormControlLabel,
  Switch,
} from '@mui/material';
import type { Account } from '../../types';
import { apiClient } from '../../services/api';

interface EditAccountDialogProps {
  open: boolean;
  account: Account | null;
  onClose: () => void;
  onAccountUpdated: () => void;
}

export const EditAccountDialog: React.FC<EditAccountDialogProps> = ({
  open,
  account,
  onClose,
  onAccountUpdated,
}) => {
  const [alias, setAlias] = useState('');
  const [active, setActive] = useState(true);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (account) {
      setAlias(account.alias);
      setActive(account.active);
    }
  }, [account]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!account) return;

    setError('');
    setLoading(true);

    try {
      await apiClient.updateAccount(account.id, { alias, active });
      onAccountUpdated();
      handleClose();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to update account');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setError('');
    onClose();
  };

  if (!account) return null;

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>Edit Account</DialogTitle>
      <form onSubmit={handleSubmit}>
        <DialogContent>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          <TextField
            fullWidth
            label="Alias / Nickname"
            value={alias}
            onChange={(e) => setAlias(e.target.value)}
            margin="normal"
            required
          />

          <FormControlLabel
            control={<Switch checked={active} onChange={(e) => setActive(e.target.checked)} />}
            label="Active"
            sx={{ mt: 2 }}
          />

          <Alert severity="info" sx={{ mt: 2 }}>
            Inactive accounts will not be scraped for new transactions.
          </Alert>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose} disabled={loading}>
            Cancel
          </Button>
          <Button type="submit" variant="contained" disabled={loading}>
            {loading ? <CircularProgress size={24} /> : 'Save Changes'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
};