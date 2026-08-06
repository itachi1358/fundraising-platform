import nodemailer from 'nodemailer';

let transport;
let didWarnAboutMissingConfiguration = false;

const escapeHtml = (value = '') =>
  String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

function mailConfiguration() {
  const host = process.env.MAIL_HOST?.trim();
  const port = Number(process.env.MAIL_PORT || 587);
  const user = process.env.MAIL_USER?.trim();
  const pass = process.env.MAIL_PASS;
  const from = process.env.MAIL_FROM?.trim();

  if (!host || !user || !pass || !from) return null;
  return { host, port, user, pass, from };
}

function getTransport() {
  const config = mailConfiguration();
  if (!config) return null;

  if (!transport) {
    transport = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.port === 465,
      auth: { user: config.user, pass: config.pass }
    });
  }
  return transport;
}

const templates = {
  approved: {
    subject: (campaignTitle) => `Your CareConnect campaign is approved: ${campaignTitle}`,
    heading: 'Your campaign is live',
    body: 'Your campaign request has been reviewed and approved. Students can now discover and support it on CareConnect.',
    accent: '#15803d'
  },
  rejected: {
    subject: (campaignTitle) => `Update on your CareConnect campaign: ${campaignTitle}`,
    heading: 'Your campaign request needs attention',
    body: 'Your campaign request was not approved at this time.',
    accent: '#b91c1c'
  },
  goalReached: {
    subject: (campaignTitle) => `Goal achieved for ${campaignTitle}`,
    heading: 'Your fundraising goal has been achieved',
    body: 'Wonderful news — your campaign has reached its target and is now closed for further donations.',
    accent: '#7c3aed'
  },
  stopped: {
    subject: (campaignTitle) => `Your CareConnect campaign has been stopped: ${campaignTitle}`,
    heading: 'Your campaign has been stopped',
    body: 'Your campaign is no longer accepting donations. You can contact the CareConnect team if you need more information.',
    accent: '#b45309'
  }
};

function renderTemplate({ type, recipientName, campaignTitle, reason }) {
  const template = templates[type];
  if (!template) throw new Error(`Unknown campaign email type: ${type}`);

  const safeName = escapeHtml(recipientName || 'there');
  const safeCampaignTitle = escapeHtml(campaignTitle || 'your campaign');
  const safeReason = escapeHtml(reason);
  const reasonBlock = type === 'rejected' && safeReason
    ? `<p style="margin:24px 0 0;color:#334155;"><strong>Reviewer note:</strong> ${safeReason}</p>`
    : '';

  return {
    subject: template.subject(campaignTitle || 'your campaign'),
    html: `<!doctype html>
<html lang="en"><body style="margin:0;background:#f8fafc;font-family:Arial,Helvetica,sans-serif;color:#0f172a;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:32px 16px;background:#f8fafc;"><tr><td align="center">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 8px 24px rgba(15,23,42,.08);">
      <tr><td style="height:6px;background:${template.accent};"></td></tr>
      <tr><td style="padding:36px 40px;">
        <div style="font-size:14px;font-weight:700;letter-spacing:.08em;color:${template.accent};text-transform:uppercase;">CareConnect · NIT Raipur</div>
        <h1 style="margin:18px 0 12px;font-size:26px;line-height:1.25;color:#0f172a;">${template.heading}</h1>
        <p style="margin:0;font-size:16px;line-height:1.65;color:#334155;">Hello ${safeName},</p>
        <p style="margin:16px 0 0;font-size:16px;line-height:1.65;color:#334155;">${template.body}</p>
        <div style="margin:24px 0 0;padding:16px 18px;border-radius:10px;background:#f8fafc;border:1px solid #e2e8f0;">
          <div style="font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:.06em;">Campaign</div>
          <div style="margin-top:5px;font-size:16px;font-weight:700;color:#0f172a;">${safeCampaignTitle}</div>
        </div>
        ${reasonBlock}
        <p style="margin:28px 0 0;font-size:14px;line-height:1.6;color:#64748b;">Thank you for building a more caring NIT Raipur community.</p>
      </td></tr>
    </table>
  </td></tr></table>
</body></html>`
  };
}

/**
 * Sends a campaign status notification without making the calling action fail
 * if SMTP is intentionally not configured (common in local development).
 */
export async function sendCampaignStatusEmail({ type, to, recipientName, campaignTitle, reason }) {
  if (!to) return { sent: false, skipped: true, reason: 'No recipient address' };

  const config = mailConfiguration();
  const mailTransport = getTransport();
  if (!config || !mailTransport) {
    if (!didWarnAboutMissingConfiguration) {
      console.warn('Email not sent: MAIL_HOST, MAIL_USER, MAIL_PASS, and MAIL_FROM are not fully configured.');
      didWarnAboutMissingConfiguration = true;
    }
    return { sent: false, skipped: true, reason: 'Email is not configured' };
  }

  try {
    const message = renderTemplate({ type, recipientName, campaignTitle, reason });
    const info = await mailTransport.sendMail({ from: config.from, to, subject: message.subject, html: message.html });
    return { sent: true, messageId: info.messageId };
  } catch (error) {
    console.error(`Unable to send ${type} email`, error.message);
    return { sent: false, skipped: false, reason: 'Email delivery failed' };
  }
}
