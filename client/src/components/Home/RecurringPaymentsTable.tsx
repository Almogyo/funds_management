import React from 'react';
import {
  Card,
  CardContent,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Box,
} from '@mui/material';
import type { RecurringPayment } from '../../types';
import { formatCurrency } from '../../utils/dateUtils';

interface RecurringPaymentsTableProps {
  data: RecurringPayment[];
  loading?: boolean;
}

export const RecurringPaymentsTable: React.FC<RecurringPaymentsTableProps> = ({
  data,
  loading,
}) => {
  if (loading) {
    return (
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Top 5 Recurring Payments
          </Typography>
          <Box sx={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Typography color="text.secondary">Loading...</Typography>
          </Box>
        </CardContent>
      </Card>
    );
  }

  if (!data || data.length === 0) {
    return (
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Top 5 Recurring Payments
          </Typography>
          <Box sx={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Typography color="text.secondary">No recurring payments found</Typography>
          </Box>
        </CardContent>
      </Card>
    );
  }

  const topFive = data.slice(0, 5);

  return (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          Top 5 Recurring Payments
        </Typography>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell>Category</TableCell>
                <TableCell align="right">Amount</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {topFive.map((payment, index) => (
                <TableRow key={index}>
                  <TableCell>{payment.merchantName}</TableCell>
                  <TableCell>{payment.category || 'Uncategorized'}</TableCell>
                  <TableCell align="right">
                    {formatCurrency(Math.abs(payment.amount))} × {payment.frequency}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </CardContent>
    </Card>
  );
};