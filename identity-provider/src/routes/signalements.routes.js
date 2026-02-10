const express = require('express');
const router = express.Router();
const db = require('../config/database');
const authMiddleware = require('../middlewares/auth.middleware');

/**
 * @swagger
 * /api/signalements:
 *   get:
 *     summary: Récupérer tous les signalements
 *     tags: [Signalements]
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
    
    res.json(result.rows);
  } catch (error) {
    console.error('[Signalements] Erreur getAll:', error.message);
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/signalements/{id}:
 *   get:
 *     summary: Récupérer un signalement par ID
 *     tags: [Signalements]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Détails du signalement
 *       404:
 *         description: Signalement non trouvé
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
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('[Signalements] Erreur getById:', error.message);
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/signalements:
 *   post:
 *     summary: Créer un nouveau signalement
 *     tags: [Signalements]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - description
 *               - latitude
 *               - longitude
 *             properties:
 *               description:
 *                 type: string
 *               latitude:
 *                 type: number
 *               longitude:
 *                 type: number
 *               surface_m2:
 *                 type: number
 *               budget:
 *                 type: number
 *               date_signalement:
 *                 type: string
 *     responses:
 *       201:
 *         description: Signalement créé
 */
router.post('/', async (req, res) => {
  try {
    const { description, latitude, longitude, surface_m2, budget, date_signalement, source } = req.body;
    
    // Récupérer l'ID utilisateur depuis le token si disponible
    let id_user = null;
    if (req.user && req.user.id) {
      id_user = req.user.id;
    }
    
    const result = await db.query(`
      INSERT INTO signalements (
        id_user,
        id_statut,
        description,
        surface_m2,
        budget,
        date_signalement,
        geom,
        source,
        synced,
        created_at
      ) VALUES (
        $1,
        1,
        $2,
        $3,
        $4,
        $5,
        ST_SetSRID(ST_MakePoint($6, $7), 4326),
        $8,
        false,
        NOW()
      )
      RETURNING 
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
    `, [
      id_user,
      description,
      surface_m2 || null,
      budget || null,
      date_signalement || new Date().toISOString().split('T')[0],
      longitude,
      latitude,
      source || 'LOCAL'
    ]);
    
    console.log('[Signalements] Nouveau signalement créé:', result.rows[0].id_signalement);
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('[Signalements] Erreur create:', error.message);
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/signalements/{id}:
 *   put:
 *     summary: Mettre à jour un signalement
 *     tags: [Signalements]
 */
router.put('/:id', async (req, res) => {
  try {
    const { description, latitude, longitude, surface_m2, budget, date_signalement, id_statut, id_entreprise } = req.body;
    
    const result = await db.query(`
      UPDATE signalements SET
        description = COALESCE($1, description),
        surface_m2 = COALESCE($2, surface_m2),
        budget = COALESCE($3, budget),
        date_signalement = COALESCE($4, date_signalement),
        geom = CASE WHEN $5::float IS NOT NULL AND $6::float IS NOT NULL 
               THEN ST_SetSRID(ST_MakePoint($5, $6), 4326) 
               ELSE geom END,
        id_statut = COALESCE($7, id_statut),
        id_entreprise = COALESCE($8, id_entreprise)
      WHERE id_signalement = $9
      RETURNING 
        id_signalement,
        id_user,
        id_statut,
        id_entreprise,
        description,
        surface_m2,
        budget,
        date_signalement,
        ST_X(geom) AS longitude,
        ST_Y(geom) AS latitude,
        source,
        synced,
        created_at
    `, [
      description,
      surface_m2,
      budget,
      date_signalement,
      longitude,
      latitude,
      id_statut,
      id_entreprise,
      req.params.id
    ]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Signalement non trouvé' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('[Signalements] Erreur update:', error.message);
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/signalements/{id}:
 *   delete:
 *     summary: Supprimer un signalement
 *     tags: [Signalements]
 */
router.delete('/:id', async (req, res) => {
  try {
    const result = await db.query(
      'DELETE FROM signalements WHERE id_signalement = $1 RETURNING id_signalement',
      [req.params.id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Signalement non trouvé' });
    }
    
    res.json({ success: true, id_signalement: req.params.id });
  } catch (error) {
    console.error('[Signalements] Erreur delete:', error.message);
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/signalements/stats:
 *   get:
 *     summary: Récupérer les statistiques des signalements
 *     tags: [Signalements]
 */
router.get('/stats', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN id_statut = 1 THEN 1 ELSE 0 END) AS nouveau,
        SUM(CASE WHEN id_statut = 2 THEN 1 ELSE 0 END) AS en_cours,
        SUM(CASE WHEN id_statut = 3 THEN 1 ELSE 0 END) AS termine,
        COALESCE(SUM(surface_m2), 0) AS surface_totale,
        COALESCE(SUM(budget), 0) AS budget_total,
        SUM(CASE WHEN synced = true THEN 1 ELSE 0 END) AS synced,
        SUM(CASE WHEN synced = false THEN 1 ELSE 0 END) AS not_synced
      FROM signalements
    `);
    
    const stats = result.rows[0];
    res.json({
      total: parseInt(stats.total),
      par_statut: {
        nouveau: parseInt(stats.nouveau),
        en_cours: parseInt(stats.en_cours),
        termine: parseInt(stats.termine)
      },
      surface_totale: parseFloat(stats.surface_totale),
      budget_total: parseFloat(stats.budget_total),
      synchronisation: {
        synced: parseInt(stats.synced),
        not_synced: parseInt(stats.not_synced)
      }
    });
  } catch (error) {
    console.error('[Signalements] Erreur stats:', error.message);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
