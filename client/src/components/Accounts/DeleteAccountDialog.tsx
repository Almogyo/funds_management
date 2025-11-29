import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Alert,
  CircularProgress,
} from '@mui/material';
import type { Account } from '../../types';
import { apiClient } from '../../services/api';

interface DeleteAccountDialogProps {
  open: boolean;
  account: Account | null;
  onClose: () => void;
  onAccountDeleted: () => void;
}

export const DeleteAccountDialog: React.FC<DeleteAccountDialogProps> = ({
  open,
  account,
  onClose,
  onAccountDeleted,
}) => {
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleDelete = async () => {
    if (!account) return;

    setError('');
    setLoading(true);

    try {
      await apiClient.deleteAccount(account.id);
      onAccountDeleted();
      handleClose();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to delete account');
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
      <DialogTitle>Delete Account</DialogTitle>
      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <Typography variant="body1" gutterBottom>
          Are you sure you want to delete this account?
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          <strong>Account:</strong> {account.alias}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          <strong>Number:</strong> {account.accountNumber}
        </Typography>

        <Alert severity="warning" sx={{ mt: 2 }}>
          This action cannot be undone. All associated credentials will be permanently deleted.
        </Alert>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={loading}>
          Cancel
        </Button>
        <Button onClick={handleDelete} color="error" variant="contained" disabled={loading}>
          {loading ? <CircularProgress size={24} /> : 'Delete'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};