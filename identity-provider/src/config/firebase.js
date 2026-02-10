const admin = require('firebase-admin');

function initFirebase() {
  if (admin.apps && admin.apps.length) return admin;

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  let privateKey = process.env.FIREBASE_PRIVATE_KEY;
  const gaCredPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;

  if (privateKey && privateKey.indexOf('\\n') !== -1) {
    privateKey = privateKey.replace(/\\n/g, '\n');
  }

  // If explicit env vars for service account are present, use them
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

  // If GOOGLE_APPLICATION_CREDENTIALS points to a JSON file, try loading it
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

  // Fallback to application default credentials
  try {
    admin.initializeApp({
      credential: admin.credential.applicationDefault(),
    });
    console.log('[Firebase] initialized using application default credentials');
  } catch (e) {
    // ignore
  }

  return admin;
}

module.exports = {
  initFirebase,
};