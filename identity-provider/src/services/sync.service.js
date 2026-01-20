const { initFirebase } = require('../config/firebase');
const db = require('../config/database');
const bcrypt = require('bcrypt');

/**
 * Service de synchronisation bidirectionnelle entre Firebase et PostgreSQL
 */

/**
 * Récupère tous les utilisateurs de Firebase
 * @returns {Promise<Array>} Liste des utilisateurs Firebase
 */
async function getFirebaseUsers() {
  const admin = initFirebase();
  const users = [];
  
  try {
    let nextPageToken;
    do {
      const listUsersResult = await admin.auth().listUsers(1000, nextPageToken);
      listUsersResult.users.forEach((userRecord) => {
        users.push({
          uid: userRecord.uid,
          email: userRecord.email,
          displayName: userRecord.displayName || '',
          createdAt: userRecord.metadata.creationTime,
        });
      });
      nextPageToken = listUsersResult.pageToken;
    } while (nextPageToken);
    
    return users;
  } catch (error) {
    console.error('[Sync Service] Erreur récupération utilisateurs Firebase:', error.message);
    throw error;
  }
}

/**
 * Récupère tous les utilisateurs de PostgreSQL
 * @returns {Promise<Array>} Liste des utilisateurs locaux
 */
async function getLocalUsers() {
  try {
    const result = await db.query(
      'SELECT id, firebase_uid, email, firstname, lastname, synced_from_firebase, created_at FROM users'
    );
    return result.rows;
  } catch (error) {
    console.error('[Sync Service] Erreur récupération utilisateurs locaux:', error.message);
    throw error;
  }
}

/**
 * Ajoute un utilisateur Firebase dans PostgreSQL (s'il n'existe pas déjà)
 * @param {object} firebaseUser - Utilisateur Firebase
 * @returns {Promise<object|null>} Utilisateur créé ou null si déjà existant
 */
async function addFirebaseUserToLocal(firebaseUser) {
  try {
    // Vérifier si l'utilisateur existe déjà (par email ou firebase_uid)
    const existing = await db.query(
      'SELECT id FROM users WHERE email = $1 OR firebase_uid = $2',
      [firebaseUser.email, firebaseUser.uid]
    );

    if (existing.rows.length > 0) {
      // Mettre à jour le firebase_uid si nécessaire
      await db.query(
        'UPDATE users SET firebase_uid = $1, synced_from_firebase = true WHERE email = $2 AND firebase_uid IS NULL',
        [firebaseUser.uid, firebaseUser.email]
      );
      return null; // Déjà existant
    }

    // Extraire prénom et nom du displayName
    const nameParts = (firebaseUser.displayName || '').split(' ');
    const firstname = nameParts[0] || '';
    const lastname = nameParts.slice(1).join(' ') || '';

    // Créer l'utilisateur localement
    const result = await db.query(
      `INSERT INTO users (firebase_uid, email, firstname, lastname, synced_from_firebase)
       VALUES ($1, $2, $3, $4, true)
       RETURNING id, email, firebase_uid`,
      [firebaseUser.uid, firebaseUser.email, firstname, lastname]
    );

    console.log('[Sync Service] Utilisateur Firebase ajouté en local:', firebaseUser.email);
    return result.rows[0];
  } catch (error) {
    console.error('[Sync Service] Erreur ajout utilisateur Firebase en local:', error.message);
    return null;
  }
}

/**
 * Ajoute un utilisateur local dans Firebase (s'il n'existe pas déjà)
 * Note: On ne peut pas créer un utilisateur avec mot de passe dans Firebase Admin sans connaître le mot de passe en clair
 * @param {object} localUser - Utilisateur local
 * @returns {Promise<object|null>} Utilisateur créé ou null si déjà existant/erreur
 */
async function addLocalUserToFirebase(localUser) {
  try {
    const admin = initFirebase();

    // Vérifier si l'utilisateur existe déjà dans Firebase par email
    try {
      const existingUser = await admin.auth().getUserByEmail(localUser.email);
      // L'utilisateur existe déjà, mettre à jour le firebase_uid local
      await db.query(
        'UPDATE users SET firebase_uid = $1, synced_from_firebase = true WHERE id = $2',
        [existingUser.uid, localUser.id]
      );
      return null; // Déjà existant
    } catch (error) {
      if (error.code !== 'auth/user-not-found') {
        throw error;
      }
      // L'utilisateur n'existe pas, on peut le créer
    }

    // Créer l'utilisateur dans Firebase (sans mot de passe - il devra le réinitialiser)
    const displayName = `${localUser.firstname || ''} ${localUser.lastname || ''}`.trim();
    
    const userRecord = await admin.auth().createUser({
      email: localUser.email,
      displayName: displayName || undefined,
      emailVerified: false,
    });

    // Mettre à jour le firebase_uid local
    await db.query(
      'UPDATE users SET firebase_uid = $1, synced_from_firebase = true WHERE id = $2',
      [userRecord.uid, localUser.id]
    );

    console.log('[Sync Service] Utilisateur local ajouté dans Firebase:', localUser.email);
    return { uid: userRecord.uid, email: userRecord.email };
  } catch (error) {
    console.error('[Sync Service] Erreur ajout utilisateur local dans Firebase:', error.message);
    return null;
  }
}

/**
 * Synchronisation bidirectionnelle complète
 * @returns {Promise<object>} Rapport de synchronisation
 */
async function syncAll() {
  const report = {
    firebaseToLocal: { added: 0, skipped: 0, errors: 0 },
    localToFirebase: { added: 0, skipped: 0, errors: 0 },
    totalFirebaseUsers: 0,
    totalLocalUsers: 0,
    syncedAt: new Date().toISOString(),
  };

  try {
    // 1. Récupérer tous les utilisateurs des deux sources
    console.log('[Sync Service] Récupération des utilisateurs Firebase...');
    const firebaseUsers = await getFirebaseUsers();
    report.totalFirebaseUsers = firebaseUsers.length;

    console.log('[Sync Service] Récupération des utilisateurs locaux...');
    const localUsers = await getLocalUsers();
    report.totalLocalUsers = localUsers.length;

    // 2. Synchroniser Firebase -> PostgreSQL
    console.log('[Sync Service] Synchronisation Firebase -> PostgreSQL...');
    for (const fbUser of firebaseUsers) {
      try {
        const result = await addFirebaseUserToLocal(fbUser);
        if (result) {
          report.firebaseToLocal.added++;
        } else {
          report.firebaseToLocal.skipped++;
        }
      } catch (error) {
        report.firebaseToLocal.errors++;
      }
    }

    // 3. Synchroniser PostgreSQL -> Firebase (utilisateurs sans firebase_uid)
    console.log('[Sync Service] Synchronisation PostgreSQL -> Firebase...');
    const localUsersWithoutFirebase = localUsers.filter(u => !u.firebase_uid);
    
    for (const localUser of localUsersWithoutFirebase) {
      try {
        const result = await addLocalUserToFirebase(localUser);
        if (result) {
          report.localToFirebase.added++;
        } else {
          report.localToFirebase.skipped++;
        }
      } catch (error) {
        report.localToFirebase.errors++;
      }
    }

    // Recompter les utilisateurs locaux après sync
    const updatedLocalUsers = await getLocalUsers();
    report.totalLocalUsers = updatedLocalUsers.length;

    console.log('[Sync Service] Synchronisation terminée:', JSON.stringify(report));
    return report;

  } catch (error) {
    console.error('[Sync Service] Erreur synchronisation:', error.message);
    throw error;
  }
}

/**
 * Synchronisation unidirectionnelle: Firebase -> PostgreSQL uniquement
 * @returns {Promise<object>} Rapport de synchronisation
 */
async function syncFirebaseToLocal() {
  const report = {
    added: 0,
    skipped: 0,
    errors: 0,
    totalFirebaseUsers: 0,
    syncedAt: new Date().toISOString(),
  };

  try {
    const firebaseUsers = await getFirebaseUsers();
    report.totalFirebaseUsers = firebaseUsers.length;

    for (const fbUser of firebaseUsers) {
      try {
        const result = await addFirebaseUserToLocal(fbUser);
        if (result) {
          report.added++;
        } else {
          report.skipped++;
        }
      } catch (error) {
        report.errors++;
      }
    }

    return report;
  } catch (error) {
    throw error;
  }
}

/**
 * Synchronisation unidirectionnelle: PostgreSQL -> Firebase uniquement
 * @returns {Promise<object>} Rapport de synchronisation
 */
async function syncLocalToFirebase() {
  const report = {
    added: 0,
    skipped: 0,
    errors: 0,
    totalLocalUsers: 0,
    syncedAt: new Date().toISOString(),
  };

  try {
    const localUsers = await getLocalUsers();
    report.totalLocalUsers = localUsers.length;

    const localUsersWithoutFirebase = localUsers.filter(u => !u.firebase_uid);

    for (const localUser of localUsersWithoutFirebase) {
      try {
        const result = await addLocalUserToFirebase(localUser);
        if (result) {
          report.added++;
        } else {
          report.skipped++;
        }
      } catch (error) {
        report.errors++;
      }
    }

    return report;
  } catch (error) {
    throw error;
  }
}

module.exports = {
  getFirebaseUsers,
  getLocalUsers,
  addFirebaseUserToLocal,
  addLocalUserToFirebase,
  syncAll,
  syncFirebaseToLocal,
  syncLocalToFirebase,
};
