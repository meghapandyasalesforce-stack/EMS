/**
 * Tax invoice / receipt PDF for a succeeded billing payment.
 * Total always matches the amount actually charged.
 * When BILLING_GSTIN is set, GST is shown as included (18% by default).
 */

import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { getPlanDetails } from './subscriptionPlans.js';

const gstRate = () => {
  const n = Number(process.env.BILLING_GST_RATE || 18);
  return Number.isFinite(n) && n >= 0 ? n : 18;
};

export const sellerProfile = () => ({
  legalName: process.env.BILLING_LEGAL_NAME || process.env.APP_NAME || 'Paarsiv EMS',
  address: process.env.BILLING_ADDRESS || '',
  gstin: String(process.env.BILLING_GSTIN || '').trim(),
  email: process.env.BILLING_EMAIL || process.env.EMAIL_FROM || process.env.EMAIL_USER || '',
  supportEmail: process.env.BILLING_SUPPORT_EMAIL || process.env.BILLING_EMAIL || process.env.EMAIL_FROM || '',
});

export const formatAddress = (address) => {
  if (!address) return '';
  if (typeof address === 'string') return address;
  return [address.street, address.city, address.state, address.zipCode, address.country]
    .filter(Boolean)
    .join(', ');
};

const money = (amount, currency = 'INR') => {
  const n = Number(amount || 0);
  return `${currency} ${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const dateLabel = (value) => {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return '—';
  }
};

const splitTax = (total, rate) => {
  const taxable = Math.round((total / (1 + rate / 100)) * 100) / 100;
  const tax = Math.round((total - taxable) * 100) / 100;
  return { taxable, tax };
};

/**
 * @returns {Promise<{ filename: string, buffer: Buffer, title: string }>}
 */
export const buildSubscriptionInvoicePdf = async ({ org, payment }) => {
  const seller = sellerProfile();
  const plan = getPlanDetails(payment.planId);
  const currency = payment.currency || 'INR';
  const total = (payment.amountMinor || 0) / 100;
  const hasGst = Boolean(seller.gstin);
  const rate = gstRate();
  const { taxable, tax } = hasGst ? splitTax(total, rate) : { taxable: total, tax: 0 };
  const title = hasGst ? 'Tax invoice' : 'Payment receipt';
  const invoiceNumber = payment.invoiceNumber || String(payment._id);
  const filename = `${hasGst ? 'Invoice' : 'Receipt'}-${invoiceNumber}.pdf`.replace(/[^\w.-]+/g, '-');

  const doc = await PDFDocument.create();
  const page = doc.addPage([595, 842]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const ink = rgb(0.07, 0.09, 0.15);
  const muted = rgb(0.35, 0.39, 0.45);
  const line = rgb(0.9, 0.91, 0.93);
  const brand = rgb(0.31, 0.27, 0.9);

  let y = 790;
  const draw = (text, x, size, used = font, color = ink) => {
    page.drawText(String(text || ''), { x, y, size, font: used, color });
  };

  draw(seller.legalName, 48, 16, bold, brand);
  y -= 18;
  if (seller.address) {
    draw(seller.address.slice(0, 110), 48, 9, font, muted);
    y -= 14;
  }
  if (seller.gstin) {
    draw(`GSTIN ${seller.gstin}`, 48, 9, font, muted);
    y -= 14;
  }
  if (seller.email) {
    draw(seller.email, 48, 9, font, muted);
  }

  page.drawText(title.toUpperCase(), { x: 400, y: 790, size: 14, font: bold, color: ink });
  page.drawText('PAID', { x: 520, y: 770, size: 11, font: bold, color: rgb(0.05, 0.45, 0.3) });
  page.drawText(invoiceNumber, { x: 400, y: 752, size: 10, font, color: muted });

  y = 700;
  page.drawLine({ start: { x: 48, y }, end: { x: 547, y }, thickness: 1, color: line });
  y -= 28;
  draw('Billed to', 48, 9, bold, muted);
  draw('Invoice details', 340, 9, bold, muted);
  y -= 16;
  draw(org.legalName || org.name || 'Organization', 48, 11, bold);
  draw(`Date  ${dateLabel(payment.createdAt)}`, 340, 10);
  y -= 14;
  const buyerAddress = formatAddress(org.address);
  if (buyerAddress) {
    draw(buyerAddress.slice(0, 70), 48, 9, font, muted);
    y -= 13;
  }
  draw(org.email || '', 48, 9, font, muted);
  if (org.gstNumber) {
    y -= 13;
    draw(`GSTIN ${org.gstNumber}`, 48, 9, font, muted);
  }
  page.drawText(`Period  ${dateLabel(payment.periodStart)} – ${dateLabel(payment.periodEnd)}`, {
    x: 340,
    y: y + (org.gstNumber ? 13 : 0),
    size: 10,
    font,
    color: ink,
  });
  if (payment.razorpayPaymentId) {
    page.drawText(`Payment  ${payment.razorpayPaymentId}`, {
      x: 340,
      y: y - 16,
      size: 9,
      font,
      color: muted,
    });
  }

  y -= 48;
  page.drawRectangle({ x: 48, y: y - 6, width: 499, height: 24, color: rgb(0.96, 0.97, 0.99) });
  page.drawText('Description', { x: 56, y: y, size: 9, font: bold, color: muted });
  page.drawText('Amount', { x: 470, y, size: 9, font: bold, color: muted });
  y -= 28;
  const desc = `${plan?.name || payment.planId} plan — monthly subscription`;
  draw(desc, 56, 11, bold);
  draw(money(hasGst ? taxable : total, currency), 450, 11);
  y -= 36;
  page.drawLine({ start: { x: 48, y }, end: { x: 547, y }, thickness: 1, color: line });
  y -= 22;

  if (hasGst) {
    draw('Taxable value', 340, 10, font, muted);
    draw(money(taxable, currency), 470, 10);
    y -= 16;
    draw(`GST ${rate}% included`, 340, 10, font, muted);
    draw(money(tax, currency), 470, 10);
    y -= 18;
  }
  draw('Total paid', 340, 12, bold);
  draw(money(total, currency), 450, 12, bold, brand);
  y -= 40;
  page.drawText(
    hasGst
      ? 'This document is a tax invoice. GST is included in the amount charged.'
      : 'This document is a payment receipt. Configure BILLING_GSTIN to issue a tax invoice.',
    { x: 48, y, size: 8, font, color: muted }
  );
  y -= 14;
  page.drawText('Thank you for your subscription.', { x: 48, y, size: 9, font, color: ink });

  const bytes = await doc.save();
  return { filename, buffer: Buffer.from(bytes), title, invoiceNumber, total, currency };
};
