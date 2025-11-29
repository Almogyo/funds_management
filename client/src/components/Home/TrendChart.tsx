import React from 'react';
import { Card, CardContent, Typography, Box } from '@mui/material';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import type { TrendData } from '../../types';
import { formatCurrency } from '../../utils/dateUtils';

interface TrendChartProps {
  data: TrendData[];
  loading?: boolean;
}

export const TrendChart: React.FC<TrendChartProps> = ({ data, loading }) => {
  if (loading) {
    return (
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Income & Expenses Trend
          </Typography>
          <Box sx={{ height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
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
            Income & Expenses Trend
          </Typography>
          <Box sx={{ height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Typography color="text.secondary">No data available</Typography>
          </Box>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          Income & Expenses Trend
        </Typography>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="period" />
            <YAxis tickFormatter={(value) => `₪${(value / 1000).toFixed(0)}k`} />
            <Tooltip
              formatter={(value: number) => formatCurrency(value)}
              labelStyle={{ color: '#000' }}
            />
            <Legend />
            <Bar
              dataKey="totalExpenses"
              fill="#d32f2f"
              name="Expenses"
            />
            <Bar
              dataKey="totalIncome"
              fill="#2e7d32"
              name="Income"
            />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};