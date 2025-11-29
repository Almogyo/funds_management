import React from 'react';
import { Card, CardContent, Typography, Box } from '@mui/material';
import { formatCurrency } from '../../utils/dateUtils';

interface SummaryCardProps {
  title: string;
  value: number;
  icon: React.ReactNode;
  color: string;
  currency?: string;
}

export const SummaryCard: React.FC<SummaryCardProps> = ({
  title,
  value,
  icon,
  color,
  currency = 'ILS',
}) => {
  return (
    <Card sx={{ height: '100%' }}>
      <CardContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <Box>
            <Typography color="text.secondary" variant="body2" gutterBottom>
              {title}
            </Typography>
            <Typography variant="h4" component="div" fontWeight={600}>
              {formatCurrency(value, currency)}
            </Typography>
          </Box>
          <Box
            sx={{
              backgroundColor: `${color}15`,
              color: color,
              borderRadius: 2,
              p: 1.5,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {icon}
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
};