import { format, subMonths, startOfDay, endOfDay } from 'date-fns';
import type { QuickFilter, TimeframeFilter } from '../types';

export const getQuickFilterDates = (filter: QuickFilter): TimeframeFilter => {
  const endDate = new Date();
  let startDate: Date;

  switch (filter) {
    case 'last_month':
      startDate = subMonths(endDate, 1);
      break;
    case 'last_3_months':
      startDate = subMonths(endDate, 3);
      break;
    case 'last_6_months':
      startDate = subMonths(endDate, 6);
      break;
    case 'last_year':
      startDate = subMonths(endDate, 12);
      break;
    default:
      startDate = subMonths(endDate, 1);
  }

  return {
    startDate: startOfDay(startDate),
    endDate: endOfDay(endDate),
  };
};

export const formatDateForApi = (date: Date): string => {
  return format(date, 'yyyy-MM-dd');
};

export const formatCurrency = (amount: number, currency: string = 'ILS'): string => {
  return new Intl.NumberFormat('he-IL', {
    style: 'currency',
    currency,
  }).format(amount);
};

export const formatDate = (timestamp: number): string => {
  return format(new Date(timestamp), 'dd/MM/yyyy');
};

export const formatDateTime = (timestamp: number): string => {
  return format(new Date(timestamp), 'dd/MM/yyyy HH:mm');
};