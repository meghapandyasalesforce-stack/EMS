import axios from './axios';
import { ORGANIZATION_SUBSCRIPTION_ENDPOINT } from './constant';

export const formatBillingDate = (value) => {
  if (!value || Number.isNaN(new Date(value).getTime())) return '—';
  return new Date(value).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
};

export const formatBillingMoney = (amount, currency = 'INR') => {
  const number = Number(amount || 0);
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency, maximumFractionDigits: 0 }).format(number);
  } catch {
    return `${currency} ${number}`;
  }
};

export async function downloadBillingInvoice(payment) {
  const response = await axios.get(`${ORGANIZATION_SUBSCRIPTION_ENDPOINT}/payments/${payment.id}/invoice`, {
    withCredentials: true, responseType: 'blob',
  });
  const url = URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `${payment.invoiceNumber || 'invoice'}.pdf`;
  document.body.appendChild(link);
  try { link.click(); } finally {
    link.remove();
    // Let the browser start the download before releasing its object URL.
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
