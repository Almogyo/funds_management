import React from 'react';
import { Card, CardContent, Typography, Box } from '@mui/material';
import {
  ComposedChart,
  Bar,
  Line,
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

interface CustomTooltipProps {
  active?: boolean;
  payload?: any[];
  label?: string;
}

const CustomTooltip: React.FC<CustomTooltipProps> = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload as TrendData;
    return (
      <Box
        sx={{
          backgroundColor: '#fff',
          border: '1px solid #ccc',
          padding: '8px',
          borderRadius: '4px',
        }}
      >
        <Typography variant="caption" display="block">
          <strong>{label}</strong>
        </Typography>
        <Typography variant="caption" display="block" sx={{ color: '#2e7d32' }}>
          Income: {formatCurrency(data.totalIncome)}
        </Typography>
        <Typography variant="caption" display="block" sx={{ color: '#d32f2f' }}>
          Expenses: {formatCurrency(data.totalExpenses)}
        </Typography>
        <Typography variant="caption" display="block" sx={{ color: '#f57c00' }}>
          Net: {formatCurrency(data.netAmount)}
        </Typography>
        <Typography variant="caption" display="block" sx={{ color: '#1976d2' }}>
          Profit Trend: {formatCurrency(data.profitTrend)}
        </Typography>
      </Box>
    );
  }

  return null;
};


export const TrendChart: React.FC<TrendChartProps> = ({ data, loading }) => {
  const summary = React.useMemo(() => {
    if (!data || data.length === 0) {
      return {
        averageNetAmount: 0,
        totalSavings: 0,
      };
    }

    const totalNetAmount = data.reduce((sum, item) => sum + item.netAmount, 0);
    const averageNetAmount = totalNetAmount / data.length;
    const totalSavings = data[data.length - 1]?.profitTrend || 0; // Last period's cumulative profit

    return {
      averageNetAmount,
      totalSavings,
    };
  }, [data]);

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
          <ComposedChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="period" />
            <YAxis yAxisId="left" tickFormatter={(value) => `₪${(value / 1000).toFixed(0)}k`} />
            <YAxis yAxisId="right" orientation="right" tickFormatter={(value) => `₪${(value / 1000).toFixed(0)}k`} />
            <Tooltip content={<CustomTooltip />} />
            <Legend />
            <Bar
              yAxisId="left"
              dataKey="totalExpenses"
              fill="#d32f2f"
              name="Expenses"
            />
            <Bar
              yAxisId="left"
              dataKey="totalIncome"
              fill="#2e7d32"
              name="Income"
            />
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="profitTrend"
              stroke="#1976d2"
              strokeWidth={2}
              dot={{ fill: '#1976d2', r: 4 }}
              activeDot={{ r: 6 }}
              name="Profit Trend"
            />
          </ComposedChart>
        </ResponsiveContainer>

        {/* Summary Section */}
        <Box sx={{ marginTop: 3, padding: 2, backgroundColor: '#f5f5f5', borderRadius: 1 }}>
          <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 'bold' }}>
            Period Summary
          </Typography>
          <Box sx={{ display: 'flex', justifyContent: 'space-around', gap: 2 }}>
            <Box>
              <Typography variant="caption" color="text.secondary">
                Average Net / Month
              </Typography>
              <Typography
                variant="h6"
                sx={{
                  color: summary.averageNetAmount >= 0 ? '#2e7d32' : '#d32f2f',
                  fontWeight: 'bold',
                }}
              >
                {formatCurrency(summary.averageNetAmount)}
              </Typography>
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary">
                Total Savings
              </Typography>
              <Typography
                variant="h6"
                sx={{
                  color: summary.totalSavings >= 0 ? '#2e7d32' : '#d32f2f',
                  fontWeight: 'bold',
                }}
              >
                {formatCurrency(summary.totalSavings)}
              </Typography>
            </Box>
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
};