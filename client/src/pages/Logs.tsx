import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  TextField,
  Stack,
  Alert,
  CircularProgress,
  Switch,
  FormControlLabel,
} from '@mui/material';
import type { LogEntry } from '../types';
import { formatDateTime } from '../utils/dateUtils';
import { apiClient } from '../services/api';

const POLL_INTERVAL = 3000;

export const Logs: React.FC = () => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [filteredLogs, setFilteredLogs] = useState<LogEntry[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [levelFilter, setLevelFilter] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const lastTimestampRef = useRef<string | null>(null);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    fetchInitialLogs();
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (autoRefresh) {
      startPolling();
    } else {
      stopPolling();
    }
    return () => stopPolling();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoRefresh]);

  useEffect(() => {
    filterLogs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [logs, searchQuery, levelFilter]);

  const fetchInitialLogs = async () => {
    setLoading(true);
    setError(null);

    try {
      const fetchedLogs = await apiClient.getLogs(200, undefined, undefined);
      setLogs(fetchedLogs);
      
      if (fetchedLogs.length > 0) {
        lastTimestampRef.current = fetchedLogs[0].timestamp;
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to fetch logs');
    } finally {
      setLoading(false);
    }
  };

  const fetchNewLogs = async () => {
    if (!lastTimestampRef.current) return;

    try {
      const newLogs = await apiClient.getLogs(
        undefined,
        undefined,
        lastTimestampRef.current
      );

      if (newLogs.length > 0) {
        setLogs((prevLogs) => [...newLogs, ...prevLogs]);
        lastTimestampRef.current = newLogs[0].timestamp;
      }
    } catch (err: any) {
      console.error('Failed to poll for new logs:', err);
    }
  };

  const startPolling = () => {
    if (pollIntervalRef.current) return;
    
    pollIntervalRef.current = setInterval(() => {
      fetchNewLogs();
    }, POLL_INTERVAL);
  };

  const stopPolling = () => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
  };

  const filterLogs = () => {
    let filtered = logs;

    if (levelFilter !== 'all') {
      filtered = filtered.filter((log) => log.level === levelFilter);
    }

    if (searchQuery) {
      filtered = filtered.filter(
        (log) =>
          log.message.toLowerCase().includes(searchQuery.toLowerCase()) ||
          JSON.stringify(log).toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    setFilteredLogs(filtered);
  };

  const getLevelColor = (
    level: string
  ): 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning' => {
    switch (level) {
      case 'error':
        return 'error';
      case 'warn':
        return 'warning';
      case 'info':
        return 'info';
      case 'debug':
        return 'default';
      default:
        return 'default';
    }
  };

  const renderContext = (log: LogEntry) => {
    const { timestamp, level, message, ...context } = log;
    if (Object.keys(context).length === 0) return 'N/A';
    
    return (
      <Typography
        variant="body2"
        component="pre"
        sx={{
          fontFamily: 'monospace',
          fontSize: '0.75rem',
          maxWidth: 400,
          overflow: 'auto',
          whiteSpace: 'pre-wrap',
          margin: 0,
        }}
      >
        {JSON.stringify(context, null, 2)}
      </Typography>
    );
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h4" fontWeight={600}>
          Application Logs
        </Typography>
        <FormControlLabel
          control={
            <Switch
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              color="primary"
            />
          }
          label="Real-time Updates"
        />
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      <Alert severity="info" sx={{ mb: 3 }}>
        {autoRefresh
          ? `Logs update automatically every ${POLL_INTERVAL / 1000} seconds. Showing most recent entries.`
          : 'Real-time updates are disabled. Enable to see new logs automatically.'}
      </Alert>

      <Card>
        <CardContent>
          <Stack direction="row" spacing={2} sx={{ mb: 3 }}>
            <TextField
              label="Search logs"
              variant="outlined"
              size="small"
              fullWidth
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by message or context..."
            />
            <TextField
              select
              label="Level"
              variant="outlined"
              size="small"
              value={levelFilter}
              onChange={(e) => setLevelFilter(e.target.value)}
              sx={{ minWidth: 150 }}
              SelectProps={{ native: true }}
            >
              <option value="all">All Levels</option>
              <option value="info">Info</option>
              <option value="warn">Warning</option>
              <option value="error">Error</option>
              <option value="debug">Debug</option>
            </TextField>
          </Stack>

          <Typography variant="caption" color="text.secondary" sx={{ mb: 2, display: 'block' }}>
            Showing {filteredLogs.length} of {logs.length} log entries
          </Typography>

          {filteredLogs.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <Typography variant="body1" color="text.secondary">
                {logs.length === 0
                  ? 'No logs available yet. Start using the application to generate logs.'
                  : 'No logs found matching your criteria'}
              </Typography>
            </Box>
          ) : (
            <TableContainer sx={{ maxHeight: 600 }}>
              <Table stickyHeader size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Timestamp</TableCell>
                    <TableCell>Level</TableCell>
                    <TableCell>Message</TableCell>
                    <TableCell>Context</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredLogs.map((log, index) => (
                    <TableRow key={`${log.timestamp}-${index}`} hover>
                      <TableCell sx={{ whiteSpace: 'nowrap', fontSize: '0.85rem' }}>
                        {formatDateTime(new Date(log.timestamp).getTime())}
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={log.level.toUpperCase()}
                          color={getLevelColor(log.level)}
                          size="small"
                        />
                      </TableCell>
                      <TableCell sx={{ maxWidth: 400 }}>{log.message}</TableCell>
                      <TableCell>{renderContext(log)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </CardContent>
      </Card>
    </Box>
  );
};