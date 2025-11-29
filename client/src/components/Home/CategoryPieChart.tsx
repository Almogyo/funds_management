import React from 'react';
import { Card, CardContent, Typography, Box } from '@mui/material';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import type { CategoryDistribution } from '../../types';
import { formatCurrency } from '../../utils/dateUtils';

interface CategoryPieChartProps {
  data: CategoryDistribution[];
  loading?: boolean;
}

const COLORS = [
  '#0088FE',
  '#00C49F',
  '#FFBB28',
  '#FF8042',
  '#8884D8',
  '#82ca9d',
  '#ffc658',
  '#ff7c7c',
];

export const CategoryPieChart: React.FC<CategoryPieChartProps> = ({ data, loading }) => {
  if (loading) {
    return (
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Expenses by Category
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
            Expenses by Category
          </Typography>
          <Box sx={{ height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Typography color="text.secondary">No data available</Typography>
          </Box>
        </CardContent>
      </Card>
    );
  }

  const chartData = data.map((item) => ({
    name: item.category || 'Uncategorized',
    value: Math.abs(item.totalAmount),
  }));

  return (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          Expenses by Category
        </Typography>
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={({ name, percent }) => `${name}: ${((percent ?? 0) * 100).toFixed(0)}%`}
              outerRadius={80}
              fill="#8884d8"
              dataKey="value"
            >
              {chartData.map((_entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip formatter={(value: number) => formatCurrency(value)} />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};