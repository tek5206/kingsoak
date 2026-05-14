const { onDocumentCreated, onDocumentUpdated } = require('firebase-functions/v2/firestore');
const { defineString } = require('firebase-functions/params');
const admin      = require('firebase-admin');
const nodemailer = require('nodemailer');
const fetch      = require('node-fetch');

admin.initializeApp();
const db = admin.firestore();

// ─── Ortam değişkenleri ──────────────────────────────────────────────────────
// Deploy öncesi: firebase functions:secrets:set GMAIL_USER
//                firebase functions:secrets:set GMAIL_PASS
// Veya .env.local dosyasında (emulator için):
//   GMAIL_USER=tahaekon@gmail.com
//   GMAIL_PASS=xxxx
const GMAIL_USER = defineString('GMAIL_USER');
const GMAIL_PASS = defineString('GMAIL_PASS');

function getTransporter() {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: GMAIL_USER.value(),
      pass: GMAIL_PASS.value(),
    },
  });
}

// ─── Yardımcı: Expo push bildirimi gönder ────────────────────────────────────
async function sendExpoPush(expoPushToken, title, body, data = {}) {
  if (!expoPushToken || !expoPushToken.startsWith('ExponentPushToken')) return;
  try {
    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to: expoPushToken, sound: 'default', title, body, data, badge: 1 }),
    });
    const result = await response.json();
    if (result.data?.status === 'error') {
      // production'da loglama servisi kullanılabilir (örn. Cloud Logging zaten bu logları yakalar)
      console.error('[Push] Expo push error:', result.data.message);
    }
  } catch (err) {
    console.error('[Push] Network error:', err.message);
  }
}

// ─── Yardımcı: E-posta gönder ────────────────────────────────────────────────
async function sendEmail(to, subject, html) {
  if (!to) return;
  try {
    await getTransporter().sendMail({
      from: `"Kings Oak App" <${GMAIL_USER.value()}>`,
      to,
      subject,
      html,
    });
  } catch (err) {
    console.error('[Email] Failed to send:', err.message);
  }
}

// ─── Yardımcı: Kullanıcıyı güvenli çek ──────────────────────────────────────
async function getUser(uid) {
  const snap = await db.doc(`users/${uid}`).get();
  // FIX: Admin SDK'da exists bir METHOD'dur, property değil → exists()
  if (!snap.exists()) return null;
  return snap.data();
}

// ─── Trigger 1: Yeni iş oluşturuldu → mühendise bildirim ────────────────────
exports.onJobCreated = onDocumentCreated(
  { document: 'jobs/{jobId}', region: 'europe-west1' },
  async (event) => {
    const job   = event.data.data();
    const jobId = event.params.jobId;

    if (!job.assignedTo) return;

    const engineer = await getUser(job.assignedTo);
    if (!engineer) return;

    await Promise.all([
      sendExpoPush(
        engineer.expoPushToken,
        'New Job Assigned',
        `You have been assigned a new job: ${job.title}`,
        { jobId, screen: 'EngineerJobDetail' },
      ),
      sendEmail(
        engineer.email,
        `Kings Oak: New Job Assigned - ${job.title}`,
        `
          <div style="font-family:sans-serif;max-width:480px;margin:auto">
            <h2 style="color:#0D2137">New Job Assigned</h2>
            <p>Hello <strong>${engineer.name || ''}</strong>,</p>
            <p>A new job has been assigned to you:</p>
            <table style="width:100%;border-collapse:collapse;margin:16px 0">
              <tr><td style="padding:8px;background:#EDF1F7;font-weight:bold;width:120px">Title</td><td style="padding:8px">${job.title}</td></tr>
              <tr><td style="padding:8px;background:#EDF1F7;font-weight:bold">Category</td><td style="padding:8px">${(job.categories || [job.category]).filter(Boolean).join(', ') || '-'}</td></tr>
              <tr><td style="padding:8px;background:#EDF1F7;font-weight:bold">Priority</td><td style="padding:8px">${job.priority || '-'}</td></tr>
              <tr><td style="padding:8px;background:#EDF1F7;font-weight:bold">Address</td><td style="padding:8px">${job.address || '-'}</td></tr>
              <tr><td style="padding:8px;background:#EDF1F7;font-weight:bold">Scheduled</td><td style="padding:8px">${job.scheduledDate || 'Not scheduled'}</td></tr>
            </table>
            <p>Please open the app to view the full details.</p>
            <p style="color:#8A9BB5;font-size:12px;margin-top:24px">Kings Oak Field Service App</p>
          </div>
        `,
      ),
    ]);
  },
);

// ─── Trigger 2: İş güncellendi → ilgili tarafa bildirim ─────────────────────
exports.onJobUpdated = onDocumentUpdated(
  { document: 'jobs/{jobId}', region: 'europe-west1' },
  async (event) => {
    const before = event.data.before.data();
    const after  = event.data.after.data();
    const jobId  = event.params.jobId;

    // Durum değişmediyse işlem yapma
    if (before.status === after.status) return;

    // Mühendis onaya gönderdi → tüm adminlere bildirim
    if (after.status === 'pending_approval') {
      const adminsSnap = await db.collection('users').where('role', '==', 'admin').get();

      const promises = adminsSnap.docs.map(adminDoc => {
        const adminData = adminDoc.data();
        return Promise.all([
          sendExpoPush(
            adminData.expoPushToken,
            'Job Pending Approval',
            `${after.assignedToName || 'An engineer'} has completed: ${after.title}`,
            { jobId, screen: 'AdminJobDetail' },
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
            `,
          ),
        ]);
      });

      await Promise.all(promises);
      return;
    }

    // Admin revizyon istedi → mühendise bildirim
    if (after.status === 'needs_revision') {
      if (!after.assignedTo) return;
      const engineer = await getUser(after.assignedTo);
      if (!engineer) return;

      await Promise.all([
        sendExpoPush(
          engineer.expoPushToken,
          'Revision Requested',
          `A revision has been requested for: ${after.title}`,
          { jobId, screen: 'EngineerJobDetail' },
        ),
        sendEmail(
          engineer.email,
          `Kings Oak: Revision Requested - ${after.title}`,
          `
            <div style="font-family:sans-serif;max-width:480px;margin:auto">
              <h2 style="color:#C0392B">Revision Requested</h2>
              <p>Hello <strong>${engineer.name || ''}</strong>,</p>
              <p>Your manager has requested a revision for the following job:</p>
              <table style="width:100%;border-collapse:collapse;margin:16px 0">
                <tr><td style="padding:8px;background:#EDF1F7;font-weight:bold;width:120px">Job</td><td style="padding:8px">${after.title}</td></tr>
                ${after.adminComment ? `<tr><td style="padding:8px;background:#EDF1F7;font-weight:bold">Manager Comment</td><td style="padding:8px">${after.adminComment}</td></tr>` : ''}
              </table>
              <p>Please open the app to review and update the job.</p>
              <p style="color:#8A9BB5;font-size:12px;margin-top:24px">Kings Oak Field Service App</p>
            </div>
          `,
        ),
      ]);
      return;
    }

    // Admin onayladı → mühendise bildirim
    if (after.status === 'completed') {
      if (!after.assignedTo) return;
      const engineer = await getUser(after.assignedTo);
      if (!engineer) return;

      await sendExpoPush(
        engineer.expoPushToken,
        'Job Approved! ✅',
        `Your job has been approved: ${after.title}`,
        { jobId, screen: 'EngineerJobDetail' },
      );
    }
  },
);
