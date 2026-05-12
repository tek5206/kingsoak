const { onDocumentCreated, onDocumentUpdated } = require('firebase-functions/v2/firestore');
const admin      = require('firebase-admin');
const nodemailer = require('nodemailer');
const fetch      = require('node-fetch');

admin.initializeApp();
const db = admin.firestore();

const GMAIL_USER = 'tahaekon@gmail.com';
const GMAIL_PASS = 'errwuztenikwepbp';

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: { user: GMAIL_USER, pass: GMAIL_PASS },
});

async function sendExpoPush(expoPushToken, title, body, data = {}) {
  if (!expoPushToken || !expoPushToken.startsWith('ExponentPushToken')) return;
  const response = await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ to: expoPushToken, sound: 'default', title, body, data, badge: 1 }),
  });
  const result = await response.json();
  if (result.data?.status === 'error') console.error('Expo push error:', result.data.message);
}

async function sendEmail(to, subject, html) {
  if (!to) return;
  try {
    await transporter.sendMail({ from: `"Kings Oak App" <${GMAIL_USER}>`, to, subject, html });
  } catch (err) {
    console.error('Failed to send email:', err.message);
  }
}

// New job created -> notify engineer
exports.onJobCreated = onDocumentCreated(
  { document: 'jobs/{jobId}', region: 'europe-west1' },
  async (event) => {
    const job   = event.data.data();
    const jobId = event.params.jobId;
    if (!job.assignedTo) return;

    const engineerSnap = await db.doc(`users/${job.assignedTo}`).get();
    if (!engineerSnap.exists) return;
    const engineer = engineerSnap.data();

    await sendExpoPush(
      engineer.expoPushToken,
      'New Job Assigned',
      `You have been assigned a new job: ${job.title}`,
      { jobId, screen: 'EngineerJobDetail' }
    );

    await sendEmail(
      engineer.email,
      `Kings Oak: New Job Assigned - ${job.title}`,
      `
        <div style="font-family:sans-serif;max-width:480px;margin:auto">
          <h2 style="color:#0D2137">New Job Assigned</h2>
          <p>Hello <strong>${engineer.name || ''}</strong>,</p>
          <p>A new job has been assigned to you:</p>
          <table style="width:100%;border-collapse:collapse;margin:16px 0">
            <tr><td style="padding:8px;background:#EDF1F7;font-weight:bold;width:120px">Title</td><td style="padding:8px">${job.title}</td></tr>
            <tr><td style="padding:8px;background:#EDF1F7;font-weight:bold">Category</td><td style="padding:8px">${job.category || '-'}</td></tr>
            <tr><td style="padding:8px;background:#EDF1F7;font-weight:bold">Priority</td><td style="padding:8px">${job.priority || '-'}</td></tr>
            <tr><td style="padding:8px;background:#EDF1F7;font-weight:bold">Address</td><td style="padding:8px">${job.address || '-'}</td></tr>
            <tr><td style="padding:8px;background:#EDF1F7;font-weight:bold">Scheduled</td><td style="padding:8px">${job.scheduledDate || 'Not scheduled'}</td></tr>
          </table>
          <p>Please open the app to view the full details.</p>
          <p style="color:#8A9BB5;font-size:12px;margin-top:24px">Kings Oak Field Service App</p>
        </div>
      `
    );
  }
);

// Job status updated -> notify admin or engineer
exports.onJobUpdated = onDocumentUpdated(
  { document: 'jobs/{jobId}', region: 'europe-west1' },
  async (event) => {
    const before = event.data.before.data();
    const after  = event.data.after.data();
    const jobId  = event.params.jobId;

    if (before.status === after.status) return;

    // Engineer submitted for approval -> notify all admins
    if (after.status === 'pending_approval') {
      const adminsSnap = await db.collection('users').where('role', '==', 'admin').get();
      const promises = adminsSnap.docs.map(adminDoc => {
        const adminData = adminDoc.data();
        return Promise.all([
          sendExpoPush(
            adminData.expoPushToken,
            'Job Pending Approval',
            `${after.assignedToName || 'An engineer'} has completed: ${after.title}`,
            { jobId, screen: 'AdminJobDetail' }
          ),
          sendEmail(
            adminData.email,
            `Kings Oak: Job Pending Approval - ${after.title}`,
            `
              <div style="font-family:sans-serif;max-width:480px;margin:auto">
                <h2 style="color:#7B2FA5">Job Pending Approval</h2>
                <p>Hello <strong>${adminData.name || 'Admin'}</strong>,</p>
                <p><strong>${after.assignedToName || 'An engineer'}</strong> has completed the following job and it is awaiting your approval:</p>
                <table style="width:100%;border-collapse:collapse;margin:16px 0">
                  <tr><td style="padding:8px;background:#EDF1F7;font-weight:bold;width:120px">Job</td><td style="padding:8px">${after.title}</td></tr>
                  <tr><td style="padding:8px;background:#EDF1F7;font-weight:bold">Engineer</td><td style="padding:8px">${after.assignedToName || '-'}</td></tr>
                  ${after.engineerNote ? `<tr><td style="padding:8px;background:#EDF1F7;font-weight:bold">Note</td><td style="padding:8px">${after.engineerNote}</td></tr>` : ''}
                </table>
                <p>Please open the app to approve or request a revision.</p>
                <p style="color:#8A9BB5;font-size:12px;margin-top:24px">Kings Oak Field Service App</p>
              </div>
            `
          ),
        ]);
      });
      await Promise.all(promises);
    }

    // Admin requested revision -> notify engineer
    if (after.status === 'needs_revision') {
      if (!after.assignedTo) return;
      const engineerSnap = await db.doc(`users/${after.assignedTo}`).get();
      if (!engineerSnap.exists) return;
      const engineer = engineerSnap.data();

      await sendExpoPush(
        engineer.expoPushToken,
        'Revision Requested',
        `A revision has been requested for: ${after.title}`,
        { jobId, screen: 'EngineerJobDetail' }
      );

      await sendEmail(
        engineer.email,
        `Kings Oak: Revision Requested - ${after.title}`,
        `
          <div style="font-family:sans-serif;max-width:480px;margin:auto">
            <h2 style="color:#C0392B">Revision Requested</h2>
            <p>Hello <strong>${engineer.name || ''}</strong>,</p>
            <p>Your manager has requested a revision for the following job:</p>
            <table style="width:100%;border-collapse:collapse;margin:16px 0">
              <tr><td style="padding:8px;background:#EDF1F7;font-weight:bold;width:120px">Job</td><td style="padding:8px">${after.title}</td></tr>
              <tr><td style="padding:8px;background:#EDF1F7;font-weight:bold">Category</td><td style="padding:8px">${after.category || '-'}</td></tr>
            </table>
            <p>Please open the app to review and update the job.</p>
            <p style="color:#8A9BB5;font-size:12px;margin-top:24px">Kings Oak Field Service App</p>
          </div>
        `
      );
    }
  }
);