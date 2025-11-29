import React from 'react';
import {
  Card,
  CardContent,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Box,
} from '@mui/material';
import type { SelectChangeEvent } from '@mui/material/Select';
import type { Account } from '../../types';
import { getCompanyName } from '../../utils/companyIcons';

interface AccountFilterProps {
  accounts: Account[];
  selectedAccountIds: string[];
  onChange: (accountIds: string[]) => void;
}

export const AccountFilter: React.FC<AccountFilterProps> = ({
  accounts,
  selectedAccountIds,
  onChange,
}) => {
  const handleChange = (event: SelectChangeEvent<string[]>) => {
    const value = event.target.value;
    const newValue = typeof value === 'string' ? value.split(',') : value;
    onChange(newValue.filter((v) => v !== ''));
  };

  return (
    <Card>
      <CardContent>
        <FormControl fullWidth>
          <InputLabel id="account-filter-label">Filter by Account</InputLabel>
          <Select
            labelId="account-filter-label"
            label="Filter by Account"
            multiple
            value={selectedAccountIds}
            onChange={handleChange}
            renderValue={(selected) => (
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                {selected.length === 0 ? (
                  <Chip label="All Accounts" size="small" />
                ) : (
                  selected.map((accountId) => {
                    const account = accounts.find((a) => a.id === accountId);
                    return (
                      <Chip
                        key={accountId}
                        label={account?.alias || 'Unknown'}
                        size="small"
                      />
                    );
                  })
                )}
              </Box>
            )}
          >
            {accounts.map((account) => (
              <MenuItem key={account.id} value={account.id}>
                {account.alias} - {getCompanyName(account.companyId)}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </CardContent>
    </Card>
  );
};