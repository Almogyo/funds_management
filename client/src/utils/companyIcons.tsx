import { AccountBalance, CreditCard } from '@mui/icons-material';
import type { CompanyId } from '../types';

export const getCompanyIcon = (_companyId: CompanyId, accountType: 'bank' | 'credit') => {
  if (accountType === 'credit') {
    return <CreditCard />;
  }
  return <AccountBalance />;
};

export const getCompanyName = (companyId: CompanyId): string => {
  const names: Record<CompanyId, string> = {
    hapoalim: 'Bank Hapoalim',
    leumi: 'Bank Leumi',
    discount: 'Discount Bank',
    mizrahi: 'Mizrahi Tefahot',
    union: 'Union Bank',
    massad: 'Massad Bank',
    visaCal: 'VisaCal',
    max: 'Max',
    isracard: 'Isracard',
    amex: 'American Express',
  };
  return names[companyId] || companyId;
};

export const getAccountType = (companyId: CompanyId): 'bank' | 'credit' => {
  const creditCompanies: CompanyId[] = ['visaCal', 'max', 'isracard', 'amex'];
  return creditCompanies.includes(companyId) ? 'credit' : 'bank';
};

export const companyOptions: Array<{ value: CompanyId; label: string; type: 'bank' | 'credit' }> =
  [
    { value: 'hapoalim', label: 'Bank Hapoalim', type: 'bank' },
    { value: 'leumi', label: 'Bank Leumi', type: 'bank' },
    { value: 'discount', label: 'Discount Bank', type: 'bank' },
    { value: 'mizrahi', label: 'Mizrahi Tefahot', type: 'bank' },
    { value: 'union', label: 'Union Bank', type: 'bank' },
    { value: 'massad', label: 'Massad Bank', type: 'bank' },
    { value: 'visaCal', label: 'VisaCal', type: 'credit' },
    { value: 'max', label: 'Max', type: 'credit' },
    { value: 'isracard', label: 'Isracard', type: 'credit' },
    { value: 'amex', label: 'American Express', type: 'credit' },
  ];