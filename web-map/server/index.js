const express = require('express');
const cors = require('cors');
const db = require('./db');

const app = express();
const PORT = process.env.SERVER_PORT || 3002;

// Migration: ajouter la colonne id_firestore si elle n'existe pas
const ensureSchema = async () => {
  try {
    await db.query(`ALTER TABLE signalements ADD COLUMN IF NOT EXISTS id_firestore TEXT`);
    await db.query(`CREATE INDEX IF NOT EXISTS idx_signalements_firestore ON signalements(id_firestore)`);
    console.log('[DB] Schema sync OK (colonne id_firestore vérifiée)');
  } catch (e) {
    console.log('[DB] Schema check:', e.message);
  }
};
ensureSchema();

// Middleware
app.use(cors({
  origin: ['http://localhost:3001', 'http://localhost:3002', 'http://localhost'],
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));
app.use(express.json());

// =====================================================
// ROUTES SIGNALEMENTS
// =====================================================

// GET - Récupérer tous les signalements (avec filtre optionnel ?user_id=X)
app.get('/api/signalements', async (req, res) => {
  try {
    let whereClause = '';
    const params = [];
    if (req.query.user_id) {
      params.push(parseInt(req.query.user_id, 10));
      whereClause = 'WHERE s.id_user = $1';
    }

    const result = await db.query(`
      SELECT 
        s.id_signalement,
        s.id_user,
        s.id_statut,
        st.libelle AS statut_libelle,
        s.id_entreprise,
        e.nom AS entreprise_nom,
        s.description,
        s.surface_m2,
        s.budget,
        s.date_signalement,
        ST_X(s.geom) AS longitude,
        ST_Y(s.geom) AS latitude,
        s.source,
        s.synced,
        s.created_at
      FROM signalements s
      LEFT JOIN statuts_signalement st ON s.id_statut = st.id_statut
      LEFT JOIN entreprises e ON s.id_entreprise = e.id_entreprise
      ${whereClause}
      ORDER BY s.date_signalement DESC
    `, params);
    
    const signalements = result.rows.map(row => ({
      ...row,
      geom: row.longitude && row.latitude ? {
        coordinates: [row.longitude, row.latitude]
      } : null
    }));
    
    res.json(signalements);
  } catch (e) {
    console.error('[Signalements] Erreur getAll:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// GET - Récupérer un signalement par ID
app.get('/api/signalements/:id', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT 
        s.id_signalement,
        s.id_user,
        s.id_statut,
        st.libelle AS statut_libelle,
        s.id_entreprise,
        e.nom AS entreprise_nom,
        s.description,
        s.surface_m2,
        s.budget,
        s.date_signalement,
        ST_X(s.geom) AS longitude,
        ST_Y(s.geom) AS latitude,
        s.source,
        s.synced,
        s.created_at
      FROM signalements s
      LEFT JOIN statuts_signalement st ON s.id_statut = st.id_statut
      LEFT JOIN entreprises e ON s.id_entreprise = e.id_entreprise
      WHERE s.id_signalement = $1
    `, [req.params.id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Signalement non trouvé' });
    }
    
    const row = result.rows[0];
    res.json({
      ...row,
      geom: row.longitude && row.latitude ? {
        coordinates: [row.longitude, row.latitude]
      } : null
    });
  } catch (e) {
    console.error('[Signalements] Erreur getById:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// POST - Créer un nouveau signalement
app.post('/api/signalements', async (req, res) => {
  try {
    const { description, surface_m2, budget, id_entreprise, geom, id_user } = req.body;
    
    let query, params;
    if (geom && geom.coordinates) {
      const [lng, lat] = geom.coordinates;
      query = `
        INSERT INTO signalements (description, surface_m2, budget, id_entreprise, id_user, id_statut, geom, source, synced)
        VALUES ($1, $2, $3, $4, $5, 1, ST_SetSRID(ST_MakePoint($6, $7), 4326), 'LOCAL', false)
        RETURNING id_signalement, date_signalement, created_at
      `;
      params = [description, surface_m2 || null, budget || null, id_entreprise || null, id_user || null, lng, lat];
    } else {
      query = `
        INSERT INTO signalements (description, surface_m2, budget, id_entreprise, id_user, id_statut, source, synced)
        VALUES ($1, $2, $3, $4, $5, 1, 'LOCAL', false)
        RETURNING id_signalement, date_signalement, created_at
      `;
      params = [description, surface_m2 || null, budget || null, id_entreprise || null, id_user || null];
    }
    
    const result = await db.query(query, params);
    
    res.status(201).json({
      ...result.rows[0],
      description,
      surface_m2,
      budget,
      id_statut: 1,
      geom
    });
  } catch (e) {
    console.error('[Signalements] Erreur create:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// PUT - Mettre à jour un signalement
app.put('/api/signalements/:id', async (req, res) => {
  try {
    const { description, surface_m2, budget, id_entreprise, id_statut, geom } = req.body;
    
    let query, params;
    if (geom && geom.coordinates) {
      const [lng, lat] = geom.coordinates;
      query = `
        UPDATE signalements 
        SET description = COALESCE($1, description),
            surface_m2 = COALESCE($2, surface_m2),
            budget = COALESCE($3, budget),
            id_entreprise = COALESCE($4, id_entreprise),
            id_statut = COALESCE($5, id_statut),
            geom = ST_SetSRID(ST_MakePoint($6, $7), 4326)
        WHERE id_signalement = $8
        RETURNING *
      `;
      params = [description, surface_m2, budget, id_entreprise, id_statut, lng, lat, req.params.id];
    } else {
      query = `
        UPDATE signalements 
        SET description = COALESCE($1, description),
            surface_m2 = COALESCE($2, surface_m2),
            budget = COALESCE($3, budget),
            id_entreprise = COALESCE($4, id_entreprise),
            id_statut = COALESCE($5, id_statut)
        WHERE id_signalement = $6
        RETURNING *
      `;
      params = [description, surface_m2, budget, id_entreprise, id_statut, req.params.id];
    }
    
    const result = await db.query(query, params);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Signalement non trouvé' });
    }
    
    res.json(result.rows[0]);
  } catch (e) {
    console.error('[Signalements] Erreur update:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// PATCH - Mettre à jour le statut d'un signalement
app.patch('/api/signalements/:id/status', async (req, res) => {
  try {
    const { id_statut, id_manager } = req.body;
    
    const result = await db.query(`
      UPDATE signalements 
      SET id_statut = $1
      WHERE id_signalement = $2
      RETURNING *
    `, [id_statut, req.params.id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Signalement non trouvé' });
    }
    
    // Ajouter dans l'historique des statuts
    await db.query(`
      INSERT INTO historique_statuts (id_signalement, id_statut, id_manager)
      VALUES ($1, $2, $3)
    `, [req.params.id, id_statut, id_manager || null]);
    
    res.json(result.rows[0]);
  } catch (e) {
    console.error('[Signalements] Erreur updateStatus:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// DELETE - Supprimer un signalement
app.delete('/api/signalements/:id', async (req, res) => {
  try {
    const result = await db.query(`
      DELETE FROM signalements WHERE id_signalement = $1 RETURNING id_signalement
    `, [req.params.id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Signalement non trouvé' });
    }
    
    res.json({ success: true, deleted: result.rows[0].id_signalement });
  } catch (e) {
    console.error('[Signalements] Erreur delete:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// =====================================================
// ROUTES SYNCHRONISATION FIRESTORE <-> POSTGRESQL
// (Le frontend lit/écrit Firestore, le backend gère PostgreSQL)
// =====================================================

// POST /api/sync/pull - Reçoit les données Firestore du frontend, upsert dans PostgreSQL
app.post('/api/sync/pull', async (req, res) => {
  try {
    const { signalements } = req.body;

    if (!Array.isArray(signalements)) {
      return res.status(400).json({ success: false, error: 'signalements doit être un tableau' });
    }

    const results = { created: [], updated: [], skipped: [], errors: [] };

    for (const data of signalements) {
      const id_firestore = data.id_firestore || data.id;
      if (!id_firestore) {
        results.skipped.push('no-id');
        continue;
      }

      try {
        // Vérifier si le signalement existe déjà par son ID Firestore (TEXT, pas UUID)
        const existing = await db.query(
          'SELECT id_signalement FROM signalements WHERE id_firestore = $1',
          [id_firestore]
        );

        // Résoudre id_user : chercher par firebase_uid ou par id_user (UUID)
        let id_user = null;
        const uid = data.id_user || data.uid;
        if (uid) {
          // Vérifier si c'est un UUID valide (id_user direct)
          const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
          if (uuidRegex.test(uid)) {
            id_user = uid;
          } else {
            // Sinon chercher par firebase_uid
            const userResult = await db.query(
              'SELECT id_user FROM users WHERE firebase_uid = $1',
              [uid]
            );
            if (userResult.rows.length > 0) {
              id_user = userResult.rows[0].id_user;
            }
          }
        }

        const lng = data.longitude || null;
        const lat = data.latitude || null;

        if (existing.rows.length > 0) {
          // Mise à jour
          await db.query(`
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
              id_statut = COALESCE($8, id_statut),
              source = 'FIREBASE',
              synced = true
            WHERE id_firestore = $1
          `, [
            id_firestore,
            data.description || null,
            data.surface_m2 || null,
            data.budget || null,
            data.date_signalement || null,
            lng, lat,
            data.id_statut || null
          ]);
          results.updated.push(id_firestore);
        } else {
          // Insertion (nouveau UUID auto-généré, id_firestore stocké)
          const insertResult = await db.query(`
            INSERT INTO signalements (
              id_firestore, id_user, id_statut, description, 
              surface_m2, budget, date_signalement, geom, source, synced
            ) VALUES (
              $1, $2::uuid, $3, $4, $5, $6, $7,
              CASE 
                WHEN $8::numeric IS NOT NULL AND $9::numeric IS NOT NULL 
                THEN ST_SetSRID(ST_MakePoint($8, $9), 4326)
                ELSE NULL
              END,
              'FIREBASE', true
            )
            RETURNING id_signalement
          `, [
            id_firestore,
            id_user,
            data.id_statut || 1,
            data.description || 'Signalement depuis Firestore',
            data.surface_m2 || null,
            data.budget || null,
            data.date_signalement || new Date().toISOString().split('T')[0],
            lng, lat
          ]);
          console.log(`[Sync] Créé: ${id_firestore} → ${insertResult.rows[0].id_signalement}`);
          results.created.push(id_firestore);
        }
      } catch (err) {
        console.error(`[Sync] Erreur pour signalement ${id_firestore}:`, err.message);
        results.errors.push({ id: id_firestore, error: err.message });
      }
    }

    console.log(`[Sync] Pull terminé: ${results.created.length} créés, ${results.updated.length} MAJ, ${results.errors.length} erreurs`);
    res.json({
      success: true,
      message: `Pull terminé: ${results.created.length} créés, ${results.updated.length} mis à jour`,
      data: results
    });
  } catch (e) {
    console.error('[Sync] Erreur pull:', e.message);
    res.status(500).json({ success: false, error: e.message });
  }
});

// GET /api/sync/unsynced - Récupérer les signalements non synchronisés vers Firestore
app.get('/api/sync/unsynced', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT 
        s.id_signalement,
        s.id_firestore,
        s.id_user,
        u.firebase_uid,
        s.id_statut,
        s.description,
        s.surface_m2,
        s.budget,
        s.date_signalement,
        ST_X(s.geom) AS longitude,
        ST_Y(s.geom) AS latitude,
        s.source,
        s.synced,
        s.created_at
      FROM signalements s
      LEFT JOIN users u ON s.id_user = u.id_user
      WHERE s.id_firestore IS NULL
        AND s.geom IS NOT NULL
    `);

    console.log(`[Sync] ${result.rows.length} signalements locaux à pousser vers Firestore`);
    res.json({ success: true, signalements: result.rows });
  } catch (e) {
    console.error('[Sync] Erreur unsynced:', e.message);
    res.status(500).json({ success: false, error: e.message });
  }
});

// POST /api/sync/mark-synced - Marquer des signalements comme synchronisés
app.post('/api/sync/mark-synced', async (req, res) => {
  try {
    const { items } = req.body;

    // items = [{ id_signalement: uuid, id_firestore: string }, ...]
    if (!Array.isArray(items) || items.length === 0) {
      return res.json({ success: true, updated: 0 });
    }

    let updated = 0;
    for (const item of items) {
      const result = await db.query(
        `UPDATE signalements SET synced = true, id_firestore = COALESCE($2, id_firestore)
         WHERE id_signalement = $1
         RETURNING id_signalement`,
        [item.id_signalement, item.id_firestore || null]
      );
      updated += result.rows.length;
    }

    console.log(`[Sync] ${updated} signalements marqués comme synchronisés`);
    res.json({ success: true, updated });
  } catch (e) {
    console.error('[Sync] Erreur mark-synced:', e.message);
    res.status(500).json({ success: false, error: e.message });
  }
});

// GET /api/sync/stats - Statistiques de synchronisation
app.get('/api/sync/stats', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT 
        COUNT(*) AS total,
        SUM(CASE WHEN synced = true THEN 1 ELSE 0 END) AS synced_count,
        SUM(CASE WHEN synced = false THEN 1 ELSE 0 END) AS unsynced_count,
        SUM(CASE WHEN source = 'FIREBASE' THEN 1 ELSE 0 END) AS from_firebase,
        SUM(CASE WHEN source = 'LOCAL' THEN 1 ELSE 0 END) AS from_local
      FROM signalements
    `);

    res.json({ success: true, data: result.rows[0] });
  } catch (e) {
    console.error('[Sync] Erreur stats:', e.message);
    res.status(500).json({ success: false, error: e.message });
  }
});

// =====================================================
// ROUTES STATISTIQUES / DASHBOARD
// =====================================================

// GET - Statistiques globales
app.get('/api/stats', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT 
        COUNT(*) AS nb_signalements,
        COALESCE(SUM(surface_m2), 0) AS surface_totale,
        COALESCE(SUM(budget), 0) AS budget_total,
        ROUND(
          (SUM(CASE WHEN id_statut = 3 THEN 1 ELSE 0 END)::NUMERIC / NULLIF(COUNT(*), 0)) * 100
        , 2) AS avancement_pourcentage
      FROM signalements
    `);
    
    res.json(result.rows[0]);
  } catch (e) {
    console.error('[Stats] Erreur getStats:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// GET - Statistiques par statut
app.get('/api/stats/by-status', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT 
        st.id_statut,
        st.libelle,
        COUNT(s.id_signalement) AS count,
        COALESCE(SUM(s.surface_m2), 0) AS surface_totale,
        COALESCE(SUM(s.budget), 0) AS budget_total
      FROM statuts_signalement st
      LEFT JOIN signalements s ON st.id_statut = s.id_statut
      GROUP BY st.id_statut, st.libelle
      ORDER BY st.id_statut
    `);
    
    res.json(result.rows);
  } catch (e) {
    console.error('[Stats] Erreur getStatsByStatus:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// GET - Statistiques par entreprise
app.get('/api/stats/by-entreprise', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT 
        e.id_entreprise,
        e.nom,
        COUNT(s.id_signalement) AS count,
        COALESCE(SUM(s.surface_m2), 0) AS surface_totale,
        COALESCE(SUM(s.budget), 0) AS budget_total
      FROM entreprises e
      LEFT JOIN signalements s ON e.id_entreprise = s.id_entreprise
      GROUP BY e.id_entreprise, e.nom
      ORDER BY count DESC
    `);
    
    res.json(result.rows);
  } catch (e) {
    console.error('[Stats] Erreur getStatsByEntreprise:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// =====================================================
// ROUTES ENTREPRISES
// =====================================================

// GET - Liste des entreprises
app.get('/api/entreprises', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM entreprises ORDER BY nom');
    res.json(result.rows);
  } catch (e) {
    console.error('[Entreprises] Erreur getAll:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// =====================================================
// ROUTES STATUTS
// =====================================================

// GET - Liste des statuts
app.get('/api/statuts', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM statuts_signalement ORDER BY id_statut');
    res.json(result.rows);
  } catch (e) {
    console.error('[Statuts] Erreur getAll:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// =====================================================
// DÉMARRAGE DU SERVEUR
// =====================================================

app.listen(PORT, () => {
  console.log(`[Web-Map Server] Serveur démarré sur le port ${PORT}`);
});

module.exports = app;
