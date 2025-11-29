import React, { useState } from 'react';
import {
  Box,
  Paper,
  ToggleButtonGroup,
  ToggleButton,
  TextField,
  Stack,
  Typography,
} from '@mui/material';
import type { QuickFilter, TimeframeFilter as TimeframeFilterType } from '../../types';
import { getQuickFilterDates, formatDateForApi } from '../../utils/dateUtils';

interface TimeframeFilterProps {
  value: TimeframeFilterType;
  onChange: (filter: TimeframeFilterType) => void;
}

export const TimeframeFilter: React.FC<TimeframeFilterProps> = ({ value, onChange }) => {
  const [quickFilter, setQuickFilter] = useState<QuickFilter>('last_month');

  const handleQuickFilterChange = (_event: React.MouseEvent, newFilter: QuickFilter | null) => {
    if (newFilter) {
      setQuickFilter(newFilter);
      const dates = getQuickFilterDates(newFilter);
      onChange(dates);
    }
  };

  const handleCustomDateChange = (field: 'startDate' | 'endDate', dateString: string) => {
    const newDate = new Date(dateString);
    onChange({
      ...value,
      [field]: newDate,
    });
  };

  return (
    <Paper sx={{ p: 2 }}>
      <Typography variant="subtitle2" gutterBottom>
        Time Period
      </Typography>
      <Stack spacing={2}>
        <ToggleButtonGroup
          value={quickFilter}
          exclusive
          onChange={handleQuickFilterChange}
          size="small"
          fullWidth
        >
          <ToggleButton value="last_month">Last Month</ToggleButton>
          <ToggleButton value="last_3_months">3 Months</ToggleButton>
          <ToggleButton value="last_6_months">6 Months</ToggleButton>
          <ToggleButton value="last_year">1 Year</ToggleButton>
        </ToggleButtonGroup>

        <Box>
          <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
            Custom Range
          </Typography>
          <Stack direction="row" spacing={1}>
            <TextField
              type="date"
              label="Start Date"
              size="small"
              value={formatDateForApi(value.startDate)}
              onChange={(e) => handleCustomDateChange('startDate', e.target.value)}
              InputLabelProps={{ shrink: true }}
              fullWidth
            />
            <TextField
              type="date"
              label="End Date"
              size="small"
              value={formatDateForApi(value.endDate)}
              onChange={(e) => handleCustomDateChange('endDate', e.target.value)}
              InputLabelProps={{ shrink: true }}
              fullWidth
            />
          </Stack>
        </Box>
      </Stack>
    </Paper>
  );
};