import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Alert,
  CircularProgress,
  Typography,
  ToggleButtonGroup,
  ToggleButton,
  Box,
  LinearProgress,
} from '@mui/material';
import { apiClient } from '../../services/api';
import { formatDateForApi } from '../../utils/dateUtils';
import { subDays, subMonths } from 'date-fns';

interface ScrapeDialogProps {
  open: boolean;
  onClose: () => void;
  onScrapeComplete: () => void;
  accountIds?: string[];
}

type ScrapeRange = 'last_month' | 'all_data';

export const ScrapeDialog: React.FC<ScrapeDialogProps> = ({
  open,
  onClose,
  onScrapeComplete,
  accountIds,
}) => {
  const [range, setRange] = useState<ScrapeRange>('last_month');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<any>(null);

  const handleScrape = async () => {
    setError('');
    setResult(null);
    setLoading(true);

    try {
      const endDate = new Date();
      const startDate = range === 'last_month' ? subMonths(endDate, 1) : subDays(endDate, 365);

      const response = await apiClient.scrapeAccounts(
        formatDateForApi(startDate),
        formatDateForApi(endDate),
        accountIds
      );

      setResult(response.job);
      
      if (response.job.status === 'completed') {
        onScrapeComplete();
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Scraping failed');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      setRange('last_month');
      setError('');
      setResult(null);
      onClose();
    }
  };

  const getSuccessCount = () => {
    if (!result?.results) return 0;
    return result.results.filter((r: any) => r.success).length;
  };

  const getFailureCount = () => {
    if (!result?.results) return 0;
    return result.results.filter((r: any) => !r.success).length;
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        {accountIds && accountIds.length === 1 
          ? 'Scrape Account' 
          : 'Scrape Transactions'}
      </DialogTitle>
      <DialogContent>
        {!result && (
          <>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              {accountIds && accountIds.length === 1
                ? 'Pull transaction data from this account.'
                : 'Pull transaction data from your bank and credit card accounts.'}
            </Typography>

            <Typography variant="subtitle2" gutterBottom>
              Select Time Range
            </Typography>
            <ToggleButtonGroup
              value={range}
              exclusive
              onChange={(_e, newRange) => newRange && setRange(newRange)}
              fullWidth
              sx={{ mb: 2 }}
            >
              <ToggleButton value="last_month">
                <Box>
                  <Typography variant="body2" fontWeight={600}>
                    Last Month
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Last 30 days
                  </Typography>
                </Box>
              </ToggleButton>
              <ToggleButton value="all_data">
                <Box>
                  <Typography variant="body2" fontWeight={600}>
                    All Data
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Last 365 days
                  </Typography>
                </Box>
              </ToggleButton>
            </ToggleButtonGroup>

            <Alert severity="info" sx={{ mb: 2 }}>
              {range === 'last_month'
                ? 'Fetches transactions from the last 30 days. Quick and reliable.'
                : 'Fetches up to 365 days of history. May take longer and could hit provider limits.'}
            </Alert>
          </>
        )}

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {loading && (
          <Box sx={{ textAlign: 'center', py: 3 }}>
            <CircularProgress sx={{ mb: 2 }} />
            <Typography variant="body2" color="text.secondary">
              Scraping accounts... This may take a few moments.
            </Typography>
            <LinearProgress sx={{ mt: 2 }} />
          </Box>
        )}

        {result && (
          <Box>
            <Alert severity={result.status === 'completed' ? 'success' : 'warning'} sx={{ mb: 2 }}>
              Scraping {result.status === 'completed' ? 'completed' : 'finished with errors'}
            </Alert>

            <Typography variant="subtitle2" gutterBottom>
              Results Summary
            </Typography>
            <Box sx={{ mb: 2 }}>
              <Typography variant="body2">
                ✅ Successful: {getSuccessCount()} accounts
              </Typography>
              {getFailureCount() > 0 && (
                <Typography variant="body2" color="error">
                  ❌ Failed: {getFailureCount()} accounts
                </Typography>
              )}
              <Typography variant="body2">
                Duration: {(result.duration / 1000).toFixed(1)}s
              </Typography>
            </Box>

            {result.results && result.results.length > 0 && (
              <Box>
                <Typography variant="subtitle2" gutterBottom>
                  Account Details
                </Typography>
                {result.results.map((r: any, idx: number) => (
                  <Box
                    key={idx}
                    sx={{
                      p: 1,
                      mb: 1,
                      bgcolor: r.success ? 'success.50' : 'error.50',
                      borderRadius: 1,
                    }}
                  >
                    <Typography variant="body2" fontWeight={600}>
                      {r.accountName} ({r.companyId})
                    </Typography>
                    {r.success ? (
                      <Typography variant="caption" color="success.dark">
                        ✓ {r.transactionsCount} transactions imported
                      </Typography>
                    ) : (
                      <Typography variant="caption" color="error.dark">
                        ✗ {r.error}
                      </Typography>
                    )}
                  </Box>
                ))}
              </Box>
            )}
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={loading}>
          {result ? 'Close' : 'Cancel'}
        </Button>
        {!result && (
          <Button onClick={handleScrape} variant="contained" disabled={loading}>
            {loading ? 'Scraping...' : 'Start Scraping'}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};