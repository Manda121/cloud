const router = require('express').Router();
const db = require('../config/database');

/**
 * @swagger
 * /api/signalements:
 *   get:
 *     summary: Récupérer tous les signalements
 *     responses:
 *       200:
 *         description: Liste des signalements
 */
router.get('/', async (req, res) => {
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
    
    // Transformer pour le frontend (format geom compatible)
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

/**
 * @swagger
 * /api/signalements/{id}:
 *   get:
 *     summary: Récupérer un signalement par ID
 */
router.get('/:id', async (req, res) => {
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
    const signalement = {
      ...row,
      geom: row.longitude && row.latitude ? {
        coordinates: [row.longitude, row.latitude]
      } : null
    };
    
    res.json(signalement);
  } catch (e) {
    console.error('[Signalements] Erreur getById:', e.message);
    res.status(500).json({ error: e.message });
  }
});

/**
 * @swagger
 * /api/signalements:
 *   post:
 *     summary: Créer un nouveau signalement
 */
router.post('/', async (req, res) => {
  try {
    const { description, surface_m2, budget, id_entreprise, geom, id_user } = req.body;
    
    let geomValue = null;
    if (geom && geom.coordinates) {
      const [lng, lat] = geom.coordinates;
      geomValue = `ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)`;
    }
    
    const result = await db.query(`
      INSERT INTO signalements (description, surface_m2, budget, id_entreprise, id_user, id_statut, geom, source, synced)
      VALUES ($1, $2, $3, $4, $5, 1, ${geomValue || 'NULL'}, 'LOCAL', false)
      RETURNING id_signalement, date_signalement, created_at
    `, [description, surface_m2 || null, budget || null, id_entreprise || null, id_user || null]);
    
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

/**
 * @swagger
 * /api/signalements/{id}:
 *   put:
 *     summary: Mettre à jour un signalement
 */
router.put('/:id', async (req, res) => {
  try {
    const { description, surface_m2, budget, id_entreprise, id_statut, geom } = req.body;
    
    let geomClause = '';
    if (geom && geom.coordinates) {
      const [lng, lat] = geom.coordinates;
      geomClause = `, geom = ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)`;
    }
    
    const result = await db.query(`
      UPDATE signalements 
      SET description = COALESCE($1, description),
          surface_m2 = COALESCE($2, surface_m2),
          budget = COALESCE($3, budget),
          id_entreprise = COALESCE($4, id_entreprise),
          id_statut = COALESCE($5, id_statut)
          ${geomClause}
      WHERE id_signalement = $6
      RETURNING *
    `, [description, surface_m2, budget, id_entreprise, id_statut, req.params.id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Signalement non trouvé' });
    }
    
    res.json(result.rows[0]);
  } catch (e) {
    console.error('[Signalements] Erreur update:', e.message);
    res.status(500).json({ error: e.message });
  }
});

/**
 * @swagger
 * /api/signalements/{id}/status:
 *   patch:
 *     summary: Mettre à jour le statut d'un signalement
 */
router.patch('/:id/status', async (req, res) => {
  try {
    const { id_statut, id_manager } = req.body;
    
    // Mettre à jour le signalement
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

/**
 * @swagger
 * /api/signalements/{id}:
 *   delete:
 *     summary: Supprimer un signalement
 */
router.delete('/:id', async (req, res) => {
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

/**
 * @swagger
 * /api/signalements/stats/global:
 *   get:
 *     summary: Récupérer les statistiques globales
 */
router.get('/stats/global', async (req, res) => {
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
    console.error('[Signalements] Erreur getStats:', e.message);
    res.status(500).json({ error: e.message });
  }
});

/**
 * @swagger
 * /api/entreprises:
 *   get:
 *     summary: Récupérer toutes les entreprises
 */
router.get('/entreprises/list', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM entreprises ORDER BY nom');
    res.json(result.rows);
  } catch (e) {
    console.error('[Signalements] Erreur getEntreprises:', e.message);
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
