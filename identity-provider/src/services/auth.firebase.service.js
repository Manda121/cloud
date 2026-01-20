const { initFirebase } = require('../config/firebase');

const FIREBASE_API_KEY = process.env.FIREBASE_API_KEY;

async function register(data) {
  const admin = initFirebase();
  const user = await admin.auth().createUser({
    email: data.email,
    password: data.password,
    displayName: `${data.firstname || ''} ${data.lastname || ''}`.trim(),
  });
  const customToken = await admin.auth().createCustomToken(user.uid);
  return { uid: user.uid, email: user.email, token: customToken };
}

async function verifyIdToken(idToken) {
  const admin = initFirebase();
  const decoded = await admin.auth().verifyIdToken(idToken);
  return decoded;
}

async function updateUser(uid, data) {
  const admin = initFirebase();
  await admin.auth().updateUser(uid, {
    displayName: `${data.firstname || ''} ${data.lastname || ''}`.trim(),
  });
}

// Server-side sign in using Firebase REST API (email + password -> idToken)
async function serverSignIn(email, password) {
  if (!FIREBASE_API_KEY) throw new Error('FIREBASE_API_KEY is not set in environment');

  const url = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${FIREBASE_API_KEY}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, returnSecureToken: true }),
  });

  const data = await res.json();
  if (!res.ok) {
    const msg = data && data.error && (data.error.message || JSON.stringify(data.error)) || 'Firebase sign-in failed';
    throw new Error(msg);
  }
  // returns idToken and other info
  return data;
}

// Server-side sign up (create account) via Firebase REST API
async function serverSignUp(email, password) {
  if (!FIREBASE_API_KEY) throw new Error('FIREBASE_API_KEY is not set in environment');
  const url = `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${FIREBASE_API_KEY}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, returnSecureToken: true }),
  });
  const data = await res.json();
  if (!res.ok) {
    const msg = data && data.error && (data.error.message || JSON.stringify(data.error)) || 'Firebase sign-up failed';
    throw new Error(msg);
  }
  return data;
}

module.exports = { register, verifyIdToken, updateUser, serverSignIn, serverSignUp };
