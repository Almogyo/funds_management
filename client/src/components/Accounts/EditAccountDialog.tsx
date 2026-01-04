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
  InputAdornment,
  IconButton,
  Box,
} from '@mui/material';
import { Visibility, VisibilityOff } from '@mui/icons-material';
import type { Account } from '../../types';
import { apiClient } from '../../services/api';

interface EditAccountDialogProps {
  open: boolean;
  account: Account | null;
  onClose: () => void;
  onAccountUpdated: () => void;
}

const PASSWORD_PLACEHOLDER = '********';

export const EditAccountDialog: React.FC<EditAccountDialogProps> = ({
  open,
  account,
  onClose,
  onAccountUpdated,
}) => {
  const [alias, setAlias] = useState('');
  const [active, setActive] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState(PASSWORD_PLACEHOLDER);
  const [card6Digits, setCard6Digits] = useState('');
  const [userIdNumber, setUserIdNumber] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [passwordChanged, setPasswordChanged] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (account) {
      setAlias(account.alias);
      setActive(account.active);
      setUsername(account.username || '');
      setCard6Digits(account.card6Digits || '');
      setUserIdNumber(account.userIdNumber || '');
      setPassword(PASSWORD_PLACEHOLDER);
      setPasswordChanged(false);
      setShowPassword(false);
    }
  }, [account]);

  const isCreditCard = account && ['visaCal', 'max', 'isracard', 'amex'].includes(account.companyId);
  const requiresCard6Digits = account && ['isracard', 'amex'].includes(account.companyId);
  const requiresId = account?.companyId === 'isracard';

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newPassword = e.target.value;
    setPassword(newPassword);
    // Mark as changed if it's not the placeholder and not empty
    // If user types the placeholder or clears it, reset the changed flag
    if (newPassword === PASSWORD_PLACEHOLDER || newPassword === '') {
      setPassword(PASSWORD_PLACEHOLDER);
      setPasswordChanged(false);
    } else {
      setPasswordChanged(true);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!account) return;

    setError('');
    setLoading(true);

    try {
      const updates: any = {
        alias,
        active,
      };

      // Send credential fields if they exist or if password is being changed
      // Backend will merge with existing credentials
      if (username !== undefined && username.trim() !== '') {
        updates.username = username.trim();
      }

      // Only include password if it was changed (not placeholder)
      if (passwordChanged && password !== PASSWORD_PLACEHOLDER && password !== '') {
        updates.password = password;
      }

      // Include credit card specific fields if they exist
      if (isCreditCard) {
        if (card6Digits !== undefined && card6Digits.trim() !== '') {
          updates.card6Digits = card6Digits.trim();
        }
        if (requiresId && userIdNumber !== undefined && userIdNumber.trim() !== '') {
          updates.userIdNumber = userIdNumber.trim();
        }
      }

      await apiClient.updateAccount(account.id, updates);
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

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
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

          {requiresId && (
            <TextField
              fullWidth
              label="User Identification Number (ID)"
              value={userIdNumber}
              onChange={(e) => setUserIdNumber(e.target.value)}
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
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={handlePasswordChange}
            margin="normal"
            autoComplete="new-password"
            helperText={passwordChanged ? "Password will be updated" : "Leave as is to keep current password"}
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton
                    aria-label="toggle password visibility"
                    onClick={togglePasswordVisibility}
                    edge="end"
                  >
                    {showPassword ? <VisibilityOff /> : <Visibility />}
                  </IconButton>
                </InputAdornment>
              ),
            }}
          />

          <FormControlLabel
            control={<Switch checked={active} onChange={(e) => setActive(e.target.checked)} />}
            label="Active"
            sx={{ mt: 2 }}
          />

          <Box sx={{ mt: 1 }}>
            <Alert severity="info">
              {passwordChanged 
                ? "Your credentials will be encrypted and stored securely."
                : "Inactive accounts will not be scraped for new transactions. Leave password unchanged to keep current password."}
            </Alert>
          </Box>
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