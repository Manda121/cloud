const { initFirebase } = require('../config/firebase');
const db = require('../config/database');
const bcrypt = require('bcrypt');

const FIREBASE_API_KEY = process.env.FIREBASE_API_KEY;

/**
 * Sauvegarde un utilisateur Firebase dans la base locale PostgreSQL
 * @param {object} userData - Données de l'utilisateur
 * @returns {Promise<object>} - L'utilisateur local créé ou mis à jour
 */
async function saveUserToLocalDb(userData) {
  const { uid, email, password, firstname, lastname } = userData;
  
  try {
    // Vérifier si l'utilisateur existe déjà (par email ou firebase_uid)
    const existingUser = await db.query(
      'SELECT * FROM users WHERE email = $1 OR firebase_uid = $2',
      [email, uid]
    );

    if (existingUser.rows.length > 0) {
      // Mettre à jour l'utilisateur existant avec le firebase_uid
      const result = await db.query(
        `UPDATE users 
         SET firebase_uid = $1, 
             firstname = COALESCE($2, firstname), 
             lastname = COALESCE($3, lastname),
             synced_from_firebase = true
         WHERE email = $4 OR firebase_uid = $1
         RETURNING id, email, firebase_uid`,
        [uid, firstname, lastname, email]
      );
      console.log('[Firebase Service] Utilisateur local mis à jour:', email);
      return result.rows[0];
    }

    // Hasher le mot de passe si fourni
    let hashedPassword = null;
    if (password) {
      hashedPassword = await bcrypt.hash(password, 10);
    }

    // Créer un nouvel utilisateur local
    const result = await db.query(
      `INSERT INTO users (firebase_uid, email, password, firstname, lastname, synced_from_firebase)
       VALUES ($1, $2, $3, $4, $5, true)
       RETURNING id, email, firebase_uid`,
      [uid, email, hashedPassword, firstname || '', lastname || '']
    );
    
    console.log('[Firebase Service] Nouvel utilisateur local créé:', email);
    return result.rows[0];
  } catch (error) {
    console.error('[Firebase Service] Erreur sauvegarde locale:', error.message);
    // Ne pas échouer l'inscription Firebase si la sauvegarde locale échoue
    return null;
  }
}

async function register(data) {
  const admin = initFirebase();
  const user = await admin.auth().createUser({
    email: data.email,
    password: data.password,
    displayName: `${data.firstname || ''} ${data.lastname || ''}`.trim(),
  });
  const customToken = await admin.auth().createCustomToken(user.uid);
  
  // Sauvegarder aussi dans la base locale
  await saveUserToLocalDb({
    uid: user.uid,
    email: data.email,
    password: data.password,
    firstname: data.firstname,
    lastname: data.lastname,
  });
  
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
async function serverSignUp(email, password, firstname = '', lastname = '') {
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
    // Improve guidance for API key errors
    if (msg && msg.toLowerCase().includes('api key not valid')) {
      console.error('[Firebase Service] Firebase REST API returned API key error. Check FIREBASE_API_KEY in .env and API key restrictions in Google Cloud Console.');
      throw new Error('API key invalide pour Firebase (vérifier FIREBASE_API_KEY et les restrictions de la clé dans Google Cloud Console)');
    }
    throw new Error(msg);
  }
  
  // Sauvegarder aussi dans la base locale PostgreSQL
  await saveUserToLocalDb({
    uid: data.localId,
    email: email,
    password: password,
    firstname: firstname,
    lastname: lastname,
  });
  
  return data;
}

module.exports = { register, verifyIdToken, updateUser, serverSignIn, serverSignUp, saveUserToLocalDb };
