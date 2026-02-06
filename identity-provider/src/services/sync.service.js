/**
 * Service de synchronisation entre PostgreSQL local et Firebase Firestore
 * Gère la synchronisation bidirectionnelle des signalements
 */

const db = require('../config/database');
const { initFirebase } = require('../config/firebase');

// Initialiser Firebase Admin
const admin = initFirebase();

/**
 * Référence à la collection Firestore des signalements
 */
function getSignalementsCollection() {
  const firestore = admin.firestore();
  return firestore.collection('signalements');
}

/**
 * Référence à la collection des logs de synchronisation
 */
function getSyncLogsCollection() {
  const firestore = admin.firestore();
  return firestore.collection('sync_logs');
}

// ============================================
// RÉCUPÉRATION DEPUIS FIREBASE
// ============================================

/**
 * Récupère tous les signalements depuis Firebase Firestore
 * @returns {Promise<Array>} Liste des signalements Firebase
 */
async function fetchFromFirebase() {
  try {
    const collection = getSignalementsCollection();
    const snapshot = await collection.get();
    
    const signalements = [];
    snapshot.forEach(doc => {
      signalements.push({
        firebase_id: doc.id,
        ...doc.data(),
      });
    });

    await logSyncEvent('FETCH_FROM_FIREBASE', 'SUCCESS', {
      count: signalements.length,
    });

    return signalements;
  } catch (error) {
    await logSyncEvent('FETCH_FROM_FIREBASE', 'ERROR', {
      error: error.message,
    });
    throw error;
  }
}

/**
 * Récupère les signalements Firebase modifiés depuis une certaine date
 * @param {Date} sinceDate - Date de dernière synchronisation
 */
async function fetchFromFirebaseSince(sinceDate) {
  try {
    const collection = getSignalementsCollection();
    const snapshot = await collection
      .where('updated_at', '>', sinceDate)
      .get();

    const signalements = [];
    snapshot.forEach(doc => {
      signalements.push({
        firebase_id: doc.id,
        ...doc.data(),
      });
    });

    return signalements;
  } catch (error) {
    await logSyncEvent('FETCH_FROM_FIREBASE_SINCE', 'ERROR', {
      error: error.message,
      sinceDate: sinceDate.toISOString(),
    });
    throw error;
  }
}

// ============================================
// ENVOI VERS FIREBASE
// ============================================

/**
 * Envoie un signalement vers Firebase Firestore
 * @param {Object} signalement - Signalement à synchroniser
 */
async function pushToFirebase(signalement) {
  try {
    const collection = getSignalementsCollection();
    
    const firebaseData = {
      id_signalement: signalement.id_signalement,
      id_user: signalement.id_user,
      id_statut: signalement.id_statut,
      id_entreprise: signalement.id_entreprise || null,
      description: signalement.description,
      surface_m2: signalement.surface_m2 || null,
      budget: signalement.budget || null,
      date_signalement: signalement.date_signalement,
      latitude: signalement.latitude || null,
      longitude: signalement.longitude || null,
      source: signalement.source || 'LOCAL',
      created_at: signalement.created_at,
      updated_at: new Date().toISOString(),
      synced_from_local: true,
    };

    // Utiliser l'ID du signalement comme ID de document Firebase
    await collection.doc(signalement.id_signalement).set(firebaseData, { merge: true });

    // Marquer comme synchronisé dans la base locale
    await markLocalAsSynced(signalement.id_signalement);

    await logSyncEvent('PUSH_TO_FIREBASE', 'SUCCESS', {
      id_signalement: signalement.id_signalement,
    });

    return { success: true, id: signalement.id_signalement };
  } catch (error) {
    await logSyncEvent('PUSH_TO_FIREBASE', 'ERROR', {
      id_signalement: signalement.id_signalement,
      error: error.message,
    });
    throw error;
  }
}

/**
 * Envoie tous les signalements non synchronisés vers Firebase
 */
async function pushAllUnsyncedToFirebase() {
  const unsyncedQuery = `
    SELECT
      id_signalement,
      id_user,
      id_statut,
      id_entreprise,
      description,
      surface_m2,
      budget,
      date_signalement,
      source,
      synced,
      created_at,
      ST_Y(geom) AS latitude,
      ST_X(geom) AS longitude
    FROM signalements
    WHERE synced = false OR synced IS NULL
    ORDER BY created_at ASC
  `;

  const result = await db.query(unsyncedQuery);
  const signalements = result.rows;

  const results = {
    success: [],
    failed: [],
  };

  for (const sig of signalements) {
    try {
      await pushToFirebase(sig);
      results.success.push(sig.id_signalement);
    } catch (error) {
      results.failed.push({
        id_signalement: sig.id_signalement,
        error: error.message,
      });
    }
  }

  await logSyncEvent('PUSH_ALL_UNSYNCED', 'COMPLETED', {
    total: signalements.length,
    success: results.success.length,
    failed: results.failed.length,
  });

  return results;
}

// ============================================
// SYNCHRONISATION BIDIRECTIONNELLE
// ============================================

/**
 * Déclenche une synchronisation manuelle complète
 * @param {string} direction - 'pull' (Firebase → Local), 'push' (Local → Firebase), 'both'
 */
async function triggerManualSync(direction = 'both') {
  const syncResult = {
    direction,
    started_at: new Date().toISOString(),
    pull: null,
    push: null,
    conflicts: [],
    errors: [],
  };

  try {
    // PULL: Firebase → Local
    if (direction === 'pull' || direction === 'both') {
      syncResult.pull = await pullFromFirebase();
    }

    // PUSH: Local → Firebase
    if (direction === 'push' || direction === 'both') {
      syncResult.push = await pushAllUnsyncedToFirebase();
    }

    syncResult.completed_at = new Date().toISOString();
    syncResult.status = 'SUCCESS';

    await logSyncEvent('MANUAL_SYNC', 'SUCCESS', syncResult);
  } catch (error) {
    syncResult.errors.push(error.message);
    syncResult.status = 'PARTIAL_ERROR';
    syncResult.completed_at = new Date().toISOString();

    await logSyncEvent('MANUAL_SYNC', 'ERROR', syncResult);
  }

  return syncResult;
}

/**
 * Tire les données de Firebase vers la base locale
 */
async function pullFromFirebase() {
  const firebaseSignalements = await fetchFromFirebase();
  
  const results = {
    created: [],
    updated: [],
    conflicts: [],
    skipped: [],
  };

  for (const fbSig of firebaseSignalements) {
    try {
      const localSig = await getLocalSignalement(fbSig.id_signalement);

      if (!localSig) {
        // Nouveau signalement depuis Firebase
        await createFromFirebase(fbSig);
        results.created.push(fbSig.id_signalement);
      } else {
        // Vérifier les conflits
        const conflict = detectConflict(localSig, fbSig);
        if (conflict) {
          results.conflicts.push(conflict);
        } else if (shouldUpdate(localSig, fbSig)) {
          await updateFromFirebase(localSig.id_signalement, fbSig);
          results.updated.push(fbSig.id_signalement);
        } else {
          results.skipped.push(fbSig.id_signalement);
        }
      }
    } catch (error) {
      console.error(`Erreur sync Firebase → Local pour ${fbSig.id_signalement}:`, error.message);
    }
  }

  return results;
}

// ============================================
// GESTION DES CONFLITS
// ============================================

/**
 * Détecte un conflit entre la version locale et Firebase
 */
function detectConflict(localSig, firebaseSig) {
  // Conflit si les deux ont été modifiés et ont des valeurs différentes
  const localUpdated = new Date(localSig.created_at);
  const firebaseUpdated = firebaseSig.updated_at ? new Date(firebaseSig.updated_at) : null;

  // Si pas de date Firebase, pas de conflit
  if (!firebaseUpdated) return null;

  // Conflit si local non synchronisé ET Firebase plus récent
  if (!localSig.synced && firebaseUpdated > localUpdated) {
    // Vérifier si les données sont vraiment différentes
    const hasDifference = 
      localSig.id_statut !== firebaseSig.id_statut ||
      localSig.description !== firebaseSig.description ||
      localSig.budget !== firebaseSig.budget;

    if (hasDifference) {
      return {
        id_signalement: localSig.id_signalement,
        type: 'CONCURRENT_MODIFICATION',
        local: {
          id_statut: localSig.id_statut,
          description: localSig.description,
          updated_at: localSig.created_at,
        },
        firebase: {
          id_statut: firebaseSig.id_statut,
          description: firebaseSig.description,
          updated_at: firebaseSig.updated_at,
        },
        created_at: new Date().toISOString(),
      };
    }
  }

  return null;
}

/**
 * Résoudre un conflit manuellement
 * @param {string} id_signalement - ID du signalement en conflit
 * @param {string} resolution - 'LOCAL' garde la version locale, 'FIREBASE' garde la version Firebase
 */
async function resolveConflict(id_signalement, resolution) {
  try {
    if (resolution === 'LOCAL') {
      // Pousser la version locale vers Firebase
      const localSig = await getLocalSignalement(id_signalement);
      if (localSig) {
        await pushToFirebase(localSig);
      }
    } else if (resolution === 'FIREBASE') {
      // Tirer la version Firebase vers local
      const firebaseSig = await getFirebaseSignalement(id_signalement);
      if (firebaseSig) {
        await updateFromFirebase(id_signalement, firebaseSig);
      }
    }

    await logSyncEvent('CONFLICT_RESOLVED', 'SUCCESS', {
      id_signalement,
      resolution,
    });

    return { success: true, id_signalement, resolution };
  } catch (error) {
    await logSyncEvent('CONFLICT_RESOLVED', 'ERROR', {
      id_signalement,
      resolution,
      error: error.message,
    });
    throw error;
  }
}

/**
 * Récupère les conflits en attente de résolution
 */
async function getPendingConflicts() {
  const query = `
    SELECT * FROM sync_conflicts
    WHERE resolved = false
    ORDER BY created_at DESC
  `;
  const result = await db.query(query);
  return result.rows;
}

/**
 * Sauvegarde un conflit pour résolution ultérieure
 */
async function saveConflict(conflict) {
  const query = `
    INSERT INTO sync_conflicts (id_signalement, conflict_type, local_data, firebase_data)
    VALUES ($1, $2, $3, $4)
    ON CONFLICT (id_signalement) 
    DO UPDATE SET 
      local_data = $3,
      firebase_data = $4,
      created_at = CURRENT_TIMESTAMP
    RETURNING *
  `;
  const result = await db.query(query, [
    conflict.id_signalement,
    conflict.type,
    JSON.stringify(conflict.local),
    JSON.stringify(conflict.firebase),
  ]);
  return result.rows[0];
}

// ============================================
// SUIVI DES ERREURS ET SYNCHRONISATIONS
// ============================================

/**
 * Enregistre un événement de synchronisation (local + Firebase)
 */
async function logSyncEvent(eventType, status, details = {}) {
  try {
    // Log en base locale
    const localQuery = `
      INSERT INTO sync_logs (event_type, status, details)
      VALUES ($1, $2, $3)
      RETURNING *
    `;
    await db.query(localQuery, [eventType, status, JSON.stringify(details)]);

    // Log dans Firebase aussi (pour historique distribué)
    const logsCollection = getSyncLogsCollection();
    await logsCollection.add({
      event_type: eventType,
      status,
      details,
      created_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Erreur logging sync event:', error.message);
    // Ne pas faire échouer l'opération principale pour un problème de log
  }
}

/**
 * Récupère l'historique des synchronisations
 */
async function getSyncHistory(limit = 50) {
  const query = `
    SELECT * FROM sync_logs
    ORDER BY created_at DESC
    LIMIT $1
  `;
  const result = await db.query(query, [limit]);
  return result.rows;
}

/**
 * Récupère les erreurs de synchronisation récentes
 */
async function getSyncErrors(limit = 20) {
  const query = `
    SELECT * FROM sync_logs
    WHERE status = 'ERROR'
    ORDER BY created_at DESC
    LIMIT $1
  `;
  const result = await db.query(query, [limit]);
  return result.rows;
}

/**
 * Récupère les statistiques de synchronisation
 */
async function getSyncStats() {
  const query = `
    SELECT
      COUNT(*) AS total_events,
      COUNT(*) FILTER (WHERE status = 'SUCCESS') AS success_count,
      COUNT(*) FILTER (WHERE status = 'ERROR') AS error_count,
      MAX(created_at) AS last_sync,
      (
        SELECT COUNT(*) FROM signalements WHERE synced = true
      ) AS synced_signalements,
      (
        SELECT COUNT(*) FROM signalements WHERE synced = false OR synced IS NULL
      ) AS unsynced_signalements,
      (
        SELECT COUNT(*) FROM sync_conflicts WHERE resolved = false
      ) AS pending_conflicts
    FROM sync_logs
    WHERE created_at > CURRENT_TIMESTAMP - INTERVAL '24 hours'
  `;
  const result = await db.query(query);
  return result.rows[0];
}

// ============================================
// HELPERS INTERNES
// ============================================

/**
 * Récupère un signalement local par ID
 */
async function getLocalSignalement(id) {
  const query = `
    SELECT
      id_signalement,
      id_user,
      id_statut,
      id_entreprise,
      description,
      surface_m2,
      budget,
      date_signalement,
      source,
      synced,
      created_at,
      ST_Y(geom) AS latitude,
      ST_X(geom) AS longitude
    FROM signalements
    WHERE id_signalement = $1
  `;
  const result = await db.query(query, [id]);
  return result.rows[0] || null;
}

/**
 * Récupère un signalement Firebase par ID
 */
async function getFirebaseSignalement(id) {
  try {
    const collection = getSignalementsCollection();
    const doc = await collection.doc(id).get();
    if (!doc.exists) return null;
    return { firebase_id: doc.id, ...doc.data() };
  } catch (error) {
    console.error('Erreur récupération Firebase:', error.message);
    return null;
  }
}

/**
 * Crée un signalement local depuis les données Firebase
 */
async function createFromFirebase(fbSig) {
  const query = `
    INSERT INTO signalements (
      id_signalement, id_user, id_statut, id_entreprise,
      description, surface_m2, budget, date_signalement,
      geom, source, synced, created_at
    )
    VALUES (
      $1, $2, $3, $4,
      $5, $6, $7, $8,
      CASE WHEN $9::double precision IS NOT NULL AND $10::double precision IS NOT NULL
           THEN ST_SetSRID(ST_MakePoint($10::double precision, $9::double precision), 4326)
           ELSE NULL
      END,
      'FIREBASE', true, COALESCE($11::timestamp, CURRENT_TIMESTAMP)
    )
    ON CONFLICT (id_signalement) DO NOTHING
    RETURNING id_signalement
  `;

  const params = [
    fbSig.id_signalement,
    fbSig.id_user,
    fbSig.id_statut || 1,
    fbSig.id_entreprise || null,
    fbSig.description,
    fbSig.surface_m2 || null,
    fbSig.budget || null,
    fbSig.date_signalement || null,
    fbSig.latitude || null,
    fbSig.longitude || null,
    fbSig.created_at || null,
  ];

  await db.query(query, params);
}

/**
 * Met à jour un signalement local depuis les données Firebase
 */
async function updateFromFirebase(id, fbSig) {
  const query = `
    UPDATE signalements
    SET
      id_statut = COALESCE($2, id_statut),
      id_entreprise = COALESCE($3, id_entreprise),
      description = COALESCE($4, description),
      surface_m2 = COALESCE($5, surface_m2),
      budget = COALESCE($6, budget),
      geom = CASE
        WHEN $7 IS NOT NULL AND $8 IS NOT NULL 
        THEN ST_SetSRID(ST_MakePoint($8::double precision, $7::double precision), 4326)
        ELSE geom
      END,
      synced = true,
      source = 'FIREBASE'
    WHERE id_signalement = $1
  `;

  await db.query(query, [
    id,
    fbSig.id_statut,
    fbSig.id_entreprise,
    fbSig.description,
    fbSig.surface_m2,
    fbSig.budget,
    fbSig.latitude,
    fbSig.longitude,
  ]);
}

/**
 * Marque un signalement local comme synchronisé
 */
async function markLocalAsSynced(id) {
  await db.query(
    'UPDATE signalements SET synced = true WHERE id_signalement = $1',
    [id]
  );
}

/**
 * Détermine si un signalement local doit être mis à jour depuis Firebase
 */
function shouldUpdate(localSig, firebaseSig) {
  // Si le local est déjà synchronisé et Firebase a été mis à jour plus récemment
  if (localSig.synced && firebaseSig.updated_at) {
    const firebaseUpdated = new Date(firebaseSig.updated_at);
    const localCreated = new Date(localSig.created_at);
    return firebaseUpdated > localCreated;
  }
  return false;
}

module.exports = {
  // Récupération Firebase
  fetchFromFirebase,
  fetchFromFirebaseSince,
  
  // Envoi vers Firebase
  pushToFirebase,
  pushAllUnsyncedToFirebase,
  
  // Synchronisation
  triggerManualSync,
  pullFromFirebase,
  
  // Gestion des conflits
  detectConflict,
  resolveConflict,
  getPendingConflicts,
  saveConflict,
  
  // Suivi et logs
  logSyncEvent,
  getSyncHistory,
  getSyncErrors,
  getSyncStats,
};
