/**
 * Service de synchronisation Firebase <-> PostgreSQL
 * Gère le pull/push des signalements entre Firestore et la base locale
 */

const { initFirebase } = require('../config/firebase');
const db = require('../config/database');

/**
 * Récupérer les signalements depuis Firestore et les insérer dans PostgreSQL
 * @returns {Promise<{created: string[], updated: string[], skipped: string[]}>}
 */
async function pullFromFirebase() {
  const admin = initFirebase();
  const firestore = admin.firestore();
  
  const results = {
    created: [],
    updated: [],
    skipped: [],
    errors: []
  };

  try {
    // Récupérer tous les signalements de Firestore
    const snapshot = await firestore.collection('signalements').get();
    
    if (snapshot.empty) {
      console.log('[Sync] Aucun signalement trouvé dans Firestore');
      return results;
    }

    console.log(`[Sync] ${snapshot.size} signalements trouvés dans Firestore`);

    for (const doc of snapshot.docs) {
      const data = doc.data();
      const id_signalement = doc.id;

      try {
        // Vérifier si le signalement existe déjà dans PostgreSQL
        const existing = await db.query(
          'SELECT id_signalement, source FROM signalements WHERE id_signalement = $1',
          [id_signalement]
        );

        if (existing.rows.length > 0) {
          // Mise à jour si source = FIREBASE ou si synced = false
          const updateResult = await db.query(`
            UPDATE signalements SET
              description = COALESCE($2, description),
              surface_m2 = COALESCE($3, surface_m2),
              budget = COALESCE($4, budget),
              date_signalement = COALESCE($5, date_signalement),
              geom = CASE 
                WHEN $6::numeric IS NOT NULL AND $7::numeric IS NOT NULL 
                THEN ST_SetSRID(ST_MakePoint($6, $7), 4326)
                ELSE geom
              END,
              source = 'FIREBASE',
              synced = true
            WHERE id_signalement = $1
            RETURNING id_signalement
          `, [
            id_signalement,
            data.description || null,
            data.surface_m2 || null,
            data.budget || null,
            data.date_signalement || null,
            data.longitude || null,
            data.latitude || null
          ]);

          if (updateResult.rows.length > 0) {
            results.updated.push(id_signalement);
          } else {
            results.skipped.push(id_signalement);
          }
        } else {
          // Insertion nouveau signalement
          // Trouver l'utilisateur par firebase_uid si disponible
          let id_user = null;
          if (data.owner_uid) {
            const userResult = await db.query(
              'SELECT id_user FROM users WHERE firebase_uid = $1',
              [data.owner_uid]
            );
            if (userResult.rows.length > 0) {
              id_user = userResult.rows[0].id_user;
            }
          }

          await db.query(`
            INSERT INTO signalements (
              id_signalement, id_user, id_statut, description, 
              surface_m2, budget, date_signalement, geom, source, synced
            ) VALUES (
              $1, $2, 1, $3, $4, $5, $6,
              CASE 
                WHEN $7::numeric IS NOT NULL AND $8::numeric IS NOT NULL 
                THEN ST_SetSRID(ST_MakePoint($7, $8), 4326)
                ELSE NULL
              END,
              'FIREBASE', true
            )
          `, [
            id_signalement,
            id_user,
            data.description || 'Signalement depuis mobile',
            data.surface_m2 || null,
            data.budget || null,
            data.date_signalement || new Date().toISOString().split('T')[0],
            data.longitude || null,
            data.latitude || null
          ]);

          results.created.push(id_signalement);
        }
      } catch (err) {
        console.error(`[Sync] Erreur pour signalement ${id_signalement}:`, err.message);
        results.errors.push({ id: id_signalement, error: err.message });
      }
    }

    console.log('[Sync] Pull terminé:', results);
    return results;

  } catch (err) {
    console.error('[Sync] Erreur pullFromFirebase:', err.message);
    throw err;
  }
}

/**
 * Pousser les signalements PostgreSQL vers Firestore
 * @returns {Promise<{pushed: string[], failed: string[]}>}
 */
async function pushToFirebase() {
  const admin = initFirebase();
  const firestore = admin.firestore();

  const results = {
    pushed: [],
    failed: []
  };

  try {
    // Récupérer les signalements non synchronisés ou source LOCAL
    const localSignalements = await db.query(`
      SELECT 
        id_signalement,
        id_user,
        id_statut,
        description,
        surface_m2,
        budget,
        date_signalement,
        ST_X(geom) AS longitude,
        ST_Y(geom) AS latitude,
        source,
        synced,
        created_at
      FROM signalements
      WHERE synced = false OR source = 'LOCAL'
    `);

    console.log(`[Sync] ${localSignalements.rows.length} signalements à pousser vers Firebase`);

    for (const sig of localSignalements.rows) {
      try {
        // Récupérer le firebase_uid de l'utilisateur si disponible
        let owner_uid = null;
        if (sig.id_user) {
          const userResult = await db.query(
            'SELECT firebase_uid FROM users WHERE id_user = $1',
            [sig.id_user]
          );
          if (userResult.rows.length > 0) {
            owner_uid = userResult.rows[0].firebase_uid;
          }
        }

        const docRef = firestore.collection('signalements').doc(sig.id_signalement);
        await docRef.set({
          id_signalement: sig.id_signalement,
          description: sig.description || '',
          surface_m2: sig.surface_m2 ? parseFloat(sig.surface_m2) : null,
          budget: sig.budget ? parseFloat(sig.budget) : null,
          date_signalement: sig.date_signalement ? sig.date_signalement.toISOString().split('T')[0] : null,
          longitude: sig.longitude ? parseFloat(sig.longitude) : null,
          latitude: sig.latitude ? parseFloat(sig.latitude) : null,
          id_statut: sig.id_statut,
          owner_uid: owner_uid,
          synced_from_web: true,
          updated_at: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

        // Marquer comme synchronisé dans PostgreSQL
        await db.query(
          'UPDATE signalements SET synced = true WHERE id_signalement = $1',
          [sig.id_signalement]
        );

        results.pushed.push(sig.id_signalement);
      } catch (err) {
        console.error(`[Sync] Erreur push signalement ${sig.id_signalement}:`, err.message);
        results.failed.push(sig.id_signalement);
      }
    }

    console.log('[Sync] Push terminé:', results);
    return results;

  } catch (err) {
    console.error('[Sync] Erreur pushToFirebase:', err.message);
    throw err;
  }
}

/**
 * Synchronisation bidirectionnelle
 * @param {string} direction - 'pull', 'push', ou 'both'
 */
async function triggerSync(direction = 'both') {
  const results = {
    pull: null,
    push: null
  };

  if (direction === 'pull' || direction === 'both') {
    results.pull = await pullFromFirebase();
  }

  if (direction === 'push' || direction === 'both') {
    results.push = await pushToFirebase();
  }

  return results;
}

/**
 * Récupérer les statistiques de synchronisation
 */
async function getSyncStats() {
  const result = await db.query(`
    SELECT 
      COUNT(*) AS total,
      SUM(CASE WHEN synced = true THEN 1 ELSE 0 END) AS synced_count,
      SUM(CASE WHEN synced = false THEN 1 ELSE 0 END) AS unsynced_count,
      SUM(CASE WHEN source = 'FIREBASE' THEN 1 ELSE 0 END) AS from_firebase,
      SUM(CASE WHEN source = 'LOCAL' THEN 1 ELSE 0 END) AS from_local
    FROM signalements
  `);

  return result.rows[0];
}

module.exports = {
  pullFromFirebase,
  pushToFirebase,
  triggerSync,
  getSyncStats
};
