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
    console.log('[Firebase Admin] Initialized with application default credentials', {
      hasGoogleCredentialsPath: !!adcPath,
      projectId: projectId || undefined,
    });
    return admin;
  } catch (e) {
    console.error('[Firebase Admin] Initialization failed:', e && e.message ? e.message : e);
    throw e;
  }
}

module.exports = {
  initFirebase,
};