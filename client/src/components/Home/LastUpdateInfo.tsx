import React from 'react';
import { Card, CardContent, Typography, Box } from '@mui/material';
import { Schedule as ScheduleIcon } from '@mui/icons-material';
import { formatDate } from '../../utils/dateUtils';
import type { Account } from '../../types';

interface LastUpdateInfoProps {
  accounts: Account[];
}

export const LastUpdateInfo: React.FC<LastUpdateInfoProps> = ({ accounts }) => {
  const getLastScrapedAt = () => {
    if (accounts.length === 0) return null;
    
    const scrapedAccounts = accounts.filter((a) => a.lastScrapedAt);
    if (scrapedAccounts.length === 0) return null;

    const sortedByDate = scrapedAccounts.sort(
      (a, b) =>
        new Date(b.lastScrapedAt!).getTime() - new Date(a.lastScrapedAt!).getTime()
    );

    return sortedByDate[0].lastScrapedAt;
  };

  const lastUpdate = getLastScrapedAt();

  return (
    <Card>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <ScheduleIcon color="action" />
          <Box>
            <Typography variant="caption" color="text.secondary" display="block">
              Last Data Update
            </Typography>
            <Typography variant="body2" fontWeight={600}>
              {lastUpdate ? formatDate(lastUpdate) : 'No data yet'}
            </Typography>
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
};