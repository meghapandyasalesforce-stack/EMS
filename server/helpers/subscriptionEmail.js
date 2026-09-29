/**
 * Subscription billing emails.
 * Payment receipts attach a PDF invoice/receipt. Other notices are HTML only.
 */

import { createEmailTransporter, getEmailFrom } from '../config/email.config.js';
import { getPlanDetails } from './subscriptionPlans.js';
import { buildSubscriptionInvoicePdf, sellerProfile } from './subscriptionInvoicePdf.js';
import logger from './logger.js';

const appName = () => process.env.APP_NAME || 'Paarsiv EMS';

const frontendBase = () =>
  (process.env.FRONTEND_URL || process.env.CLIENT_URL || 'http://localhost:5173').replace(/\/$/, '');

const formatDate = (value) => {
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

const formatMoney = (amount, currency = 'INR') => {
  const n = Number(amount || 0);
  try {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency,
      maximumFractionDigits: 2,
    }).format(n);
  } catch {
    return `${currency} ${n.toFixed(2)}`;
  }
};

const wrapHtml = ({ preheader, title, bodyHtml, footerNote }) => {
  const seller = sellerProfile();
  const support = seller.supportEmail ? `Questions? ${seller.supportEmail}` : '';
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f3f4f6;">
  <div style="display:none;max-height:0;overflow:hidden;">${preheader || ''}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:32px 12px;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;">
        <tr><td style="padding:28px 32px 8px;font-family:Segoe UI,Arial,sans-serif;">
          <div style="font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:#4f46e5;font-weight:700;">${appName()}</div>
          <h1 style="margin:10px 0 0;font-size:22px;line-height:1.3;color:#111827;font-weight:650;">${title}</h1>
        </td></tr>
        <tr><td style="padding:8px 32px 24px;font-family:Segoe UI,Arial,sans-serif;font-size:15px;line-height:1.6;color:#374151;">
          ${bodyHtml}
          <p style="margin:24px 0 0;">
            <a href="${frontendBase()}/organization/subscription" style="display:inline-block;background:#4f46e5;color:#ffffff;text-decoration:none;padding:12px 18px;border-radius:8px;font-weight:600;font-size:14px;">View subscription</a>
          </p>
        </td></tr>
        <tr><td style="padding:16px 32px 24px;background:#f9fafb;border-top:1px solid #e5e7eb;font-family:Segoe UI,Arial,sans-serif;font-size:12px;line-height:1.5;color:#6b7280;">
          ${footerNote || ''}
          <div style="margin-top:8px;">${seller.legalName}${seller.address ? ` · ${seller.address}` : ''}</div>
          ${support ? `<div>${support}</div>` : ''}
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
};

export const sendSubscriptionEmail = async ({ to, subject, title, html, preheader, footerNote, attachments }) => {
  if (!to) return { sent: false, reason: 'no_recipient' };
  try {
    const transporter = createEmailTransporter();
    if (!transporter) return { sent: false, reason: 'no_transporter' };
    await transporter.sendMail({
      from: getEmailFrom(),
      to,
      subject,
      html: wrapHtml({ preheader, title, bodyHtml: html, footerNote }),
      attachments,
    });
    logger.info('Subscription email sent', { to, subject, attachments: attachments?.length || 0 });
    return { sent: true };
  } catch (error) {
    logger.warn('Subscription email failed', { to, subject, error: error.message });
    return { sent: false, reason: error.message };
  }
};

export const sendPaymentReceiptEmail = async (org, paymentLike) => {
  const plan = getPlanDetails(paymentLike.planId);
  const currency = paymentLike.currency || 'INR';
  const price = paymentLike.amount ?? plan?.price ?? 0;
  const invoiceNumber = paymentLike.invoiceNumber || '—';
  let attachments;
  let footerNote = 'Your invoice is attached to this email.';
  try {
    const pdf = await buildSubscriptionInvoicePdf({
      org,
      payment: {
        ...paymentLike,
        planId: paymentLike.planId,
        amountMinor: Math.round(Number(price) * 100),
        currency,
        invoiceNumber: paymentLike.invoiceNumber,
        createdAt: paymentLike.createdAt || new Date(),
        periodStart: paymentLike.periodStart,
        periodEnd: paymentLike.periodEnd,
        razorpayPaymentId: paymentLike.razorpayPaymentId,
      },
    });
    attachments = [{
      filename: pdf.filename,
      content: pdf.buffer,
      contentType: 'application/pdf',
    }];
    footerNote = `${pdf.title} ${invoiceNumber} is attached as a PDF.`;
  } catch (error) {
    logger.warn('Invoice PDF skipped', { error: error.message, invoiceNumber });
    footerNote = 'We could not attach the PDF this time. Download it from Subscription & billing.';
  }

  return sendSubscriptionEmail({
    to: org.email,
    subject: `${appName()} invoice ${invoiceNumber}`,
    preheader: `Payment received for ${plan?.name || paymentLike.planId}. Invoice attached.`,
    title: 'Payment received',
    footerNote,
    attachments,
    html: `
      <p style="margin:0 0 12px;">Hello ${org.name || 'there'},</p>
      <p style="margin:0 0 16px;">We received your payment. A PDF invoice is attached.</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:8px;">
        <tr><td style="padding:10px 14px;color:#6b7280;">Plan</td><td style="padding:10px 14px;text-align:right;font-weight:600;">${plan?.name || paymentLike.planId}</td></tr>
        <tr><td style="padding:10px 14px;color:#6b7280;border-top:1px solid #f3f4f6;">Invoice</td><td style="padding:10px 14px;text-align:right;border-top:1px solid #f3f4f6;">${invoiceNumber}</td></tr>
        <tr><td style="padding:10px 14px;color:#6b7280;border-top:1px solid #f3f4f6;">Amount paid</td><td style="padding:10px 14px;text-align:right;border-top:1px solid #f3f4f6;font-weight:600;">${formatMoney(price, currency)}</td></tr>
        <tr><td style="padding:10px 14px;color:#6b7280;border-top:1px solid #f3f4f6;">Access until</td><td style="padding:10px 14px;text-align:right;border-top:1px solid #f3f4f6;">${formatDate(paymentLike.periodEnd)}</td></tr>
      </table>
      <p style="margin:16px 0 0;">Renew before that date so paid features stay available.</p>
    `,
  });
};

export const sendRenewalReminderEmail = async (org) => {
  const plan = getPlanDetails(org.subscriptionPlan);
  const daysLeft = Math.max(
    1,
    Math.ceil((new Date(org.subscriptionEndDate) - new Date()) / (1000 * 60 * 60 * 24))
  );
  return sendSubscriptionEmail({
    to: org.email,
    subject: `${appName()} — renew ${plan?.name || 'your plan'} in ${daysLeft} day(s)`,
    preheader: `Access ends ${formatDate(org.subscriptionEndDate)}.`,
    title: 'Your subscription is ending soon',
    html: `
      <p style="margin:0 0 12px;">Hello ${org.name || 'there'},</p>
      <p style="margin:0;">The <strong>${plan?.name || org.subscriptionPlan}</strong> plan ends on <strong>${formatDate(org.subscriptionEndDate)}</strong> (${daysLeft} day(s) left). Pay again so payroll and other paid modules stay open.</p>
    `,
  });
};

export const sendSubscriptionExpiredEmail = async (org) => {
  const plan = getPlanDetails(org.subscriptionPlan);
  return sendSubscriptionEmail({
    to: org.email,
    subject: `${appName()} — ${plan?.name || 'plan'} access ended`,
    preheader: 'Paid features are locked until you renew.',
    title: 'Subscription expired',
    html: `
      <p style="margin:0 0 12px;">Hello ${org.name || 'there'},</p>
      <p style="margin:0;">Your <strong>${plan?.name || org.subscriptionPlan}</strong> plan ended on <strong>${formatDate(org.subscriptionEndDate)}</strong>. Paid modules are locked. Employee records are unchanged.</p>
    `,
  });
};

export const sendPaymentFailedEmail = async (org, reason) => {
  const plan = getPlanDetails(org.subscriptionPlan);
  return sendSubscriptionEmail({
    to: org.email,
    subject: `${appName()} — payment failed`,
    preheader: 'We could not collect your subscription payment.',
    title: 'Payment failed',
    html: `
      <p style="margin:0 0 12px;">Hello ${org.name || 'there'},</p>
      <p style="margin:0;">A payment for the <strong>${plan?.name || org.subscriptionPlan}</strong> plan did not go through.${reason ? ` ${reason}` : ''} Open Subscription &amp; billing to pay again.</p>
    `,
  });
};
