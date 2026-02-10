const admin = require('firebase-admin');

function initFirebase() {
  if (admin.apps && admin.apps.length) return admin;

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  let privateKey = process.env.FIREBASE_PRIVATE_KEY;
  const adcPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;

  if (privateKey && privateKey.indexOf('\\n') !== -1) {
    privateKey = privateKey.replace(/\\n/g, '\n');
  }

  try {
    if (projectId && clientEmail && privateKey) {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId,
          clientEmail,
          privateKey,
        }),
      });
      console.log('[Firebase Admin] Initialized with env service account');
      return admin;
    }

    // Default path in this repo: GOOGLE_APPLICATION_CREDENTIALS points to a mounted JSON
    // Use ADC explicitly so it's clear what credential source is used.
    admin.initializeApp({
      credential: admin.credential.applicationDefault(),
    });
    console.log('[Firebase] initialized using explicit env vars');
  } else {
    // Try loading a service account JSON pointed by GOOGLE_APPLICATION_CREDENTIALS
    const gaCredPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
    if (gaCredPath) {
        const fs = require('fs');
      try {
        if (fs.existsSync(gaCredPath)) {
          const sa = JSON.parse(fs.readFileSync(gaCredPath, 'utf8'));
          admin.initializeApp({
            credential: admin.credential.cert(sa),
          });
          console.log('[Firebase] initialized using service account JSON', gaCredPath);
          return admin;
        } else {
          console.warn('[Firebase] GOOGLE_APPLICATION_CREDENTIALS set but file not found:', gaCredPath);
        }
      } catch (err) {
        console.warn('[Firebase] Failed to load service account JSON from', gaCredPath, err.message);
      }
    }
    // Fallback to application default credentials (this may produce a warning if project id not found)

    try {
      admin.initializeApp();
      console.log('[Firebase] initialized using application default credentials');
    } catch (e) {
      // ignore
    }
  }
}

module.exports = {
  initFirebase,
};