const express = require('express');
const cors = require('cors');
const db = require('./db');

const app = express();
const PORT = process.env.SERVER_PORT || 3002;

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

// GET - Récupérer tous les signalements
app.get('/api/signalements', async (req, res) => {
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
      ORDER BY s.date_signalement DESC
    `);
    
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
    
    // Convertir les valeurs vides en null pour PostgreSQL
    const cleanDescription = description || null;
    const cleanSurface = surface_m2 !== '' && surface_m2 !== null ? parseFloat(surface_m2) : null;
    const cleanBudget = budget !== '' && budget !== null ? parseFloat(budget) : null;
    const cleanEntreprise = id_entreprise !== '' && id_entreprise !== null ? id_entreprise : null;
    const cleanStatut = id_statut !== '' && id_statut !== null ? parseInt(id_statut) : null;
    
    let query, params;
    if (geom && geom.coordinates) {
      const [lng, lat] = geom.coordinates;
      query = `
        UPDATE signalements 
        SET description = COALESCE($1, description),
            surface_m2 = COALESCE($2, surface_m2),
            budget = COALESCE($3, budget),
            id_entreprise = $4,
            id_statut = COALESCE($5, id_statut),
            geom = ST_SetSRID(ST_MakePoint($6, $7), 4326)
        WHERE id_signalement = $8
        RETURNING *
      `;
      params = [cleanDescription, cleanSurface, cleanBudget, cleanEntreprise, cleanStatut, lng, lat, req.params.id];
    } else {
      query = `
        UPDATE signalements 
        SET description = COALESCE($1, description),
            surface_m2 = COALESCE($2, surface_m2),
            budget = COALESCE($3, budget),
            id_entreprise = $4,
            id_statut = COALESCE($5, id_statut)
        WHERE id_signalement = $6
        RETURNING *
      `;
      params = [cleanDescription, cleanSurface, cleanBudget, cleanEntreprise, cleanStatut, req.params.id];
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
