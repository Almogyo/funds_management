import React from 'react';
import { Card, CardContent, Typography, Box, Table, TableBody, TableCell, TableRow } from '@mui/material';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
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

  const chartData = data.map((item, index) => ({
    name: item.category || 'Uncategorized',
    value: Math.abs(item.totalAmount),
    percentage: item.percentage,
    color: COLORS[index % COLORS.length],
  }));

  return (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          Expenses by Category
        </Typography>
        <Box 
          sx={{ 
            display: 'flex', 
            gap: 2, 
            alignItems: 'flex-start',
            flexDirection: { xs: 'column', md: 'row' },
            minHeight: 300,
          }}
        >
          {/* Pie Chart */}
          <Box 
            sx={{ 
              flex: { xs: '0 0 auto', md: '1 1 50%' },
              width: { xs: '100%', md: '50%' },
              minWidth: 0,
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              height: { xs: 250, md: 300 },
            }}
          >
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  outerRadius="80%"
                  innerRadius={0}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number) => formatCurrency(value)} />
              </PieChart>
            </ResponsiveContainer>
          </Box>

          {/* Legend Table */}
          <Box 
            sx={{ 
              flex: { xs: '0 0 auto', md: '1 1 50%' },
              width: { xs: '100%', md: '50%' },
              minWidth: 0,
              maxHeight: { xs: 250, md: 300 },
              overflowY: 'auto',
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: 1,
            }}
          >
            <Table size="small">
              <TableBody>
                {chartData.map((entry, index) => (
                  <TableRow key={index} hover>
                    <TableCell sx={{ width: 24, padding: '8px 4px' }}>
                      <Box
                        sx={{
                          width: 16,
                          height: 16,
                          backgroundColor: entry.color,
                          borderRadius: '2px',
                          border: '1px solid rgba(0,0,0,0.1)',
                        }}
                      />
                    </TableCell>
                    <TableCell sx={{ padding: '8px 4px' }}>
                      <Typography variant="body2" noWrap>
                        {entry.name}
                      </Typography>
                    </TableCell>
                    <TableCell align="right" sx={{ padding: '8px 4px', whiteSpace: 'nowrap' }}>
                      <Typography variant="body2" fontWeight={500}>
                        {entry.percentage.toFixed(1)}%
                      </Typography>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
};