const db = require('../config/database');
const fs = require('fs');
const path = require('path');

/**
 * Helper pour mapper une ligne SQL en objet JSON avec latitude/longitude
 */
function mapSignalementRow(row) {
  if (!row) return null;
  return {
    id_signalement: row.id_signalement,
    id_user: row.id_user,
    id_statut: row.id_statut,
    id_entreprise: row.id_entreprise,
    description: row.description,
    surface_m2: row.surface_m2,
    budget: row.budget,
    date_signalement: row.date_signalement,
    source: row.source,
    synced: row.synced,
    created_at: row.created_at,
    latitude: row.latitude,
    longitude: row.longitude,
  };
}

/**
 * Créer un nouveau signalement
 */
async function createSignalement(data) {
  const {
    id_user,
    id_statut,
    id_entreprise,
    description,
    surface_m2,
    budget,
    date_signalement,
    latitude,
    longitude,
    source,
    synced,
  } = data;

  if (!id_user) {
    throw new Error('id_user est requis');
  }
  if (!description) {
    throw new Error('description est requise');
  }

  const statutId = id_statut || 1; // 1 = "NOUVEAU"

  const query = `
    INSERT INTO signalements (
      id_user, id_statut, id_entreprise, description,
      surface_m2, budget, date_signalement, geom, source, synced
    )
    VALUES (
      $1, $2, $3, $4,
      $5, $6, COALESCE($7::date, CURRENT_DATE),
      CASE WHEN $8::double precision IS NOT NULL AND $9::double precision IS NOT NULL
           THEN ST_SetSRID(ST_MakePoint($9::double precision, $8::double precision), 4326)
           ELSE NULL
      END,
      COALESCE($10, 'LOCAL'),
      COALESCE($11, false)
    )
    RETURNING
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
      ST_X(geom) AS longitude;
  `;

  const params = [
    id_user,
    statutId,
    id_entreprise || null,
    description,
    surface_m2 || null,
    budget || null,
    date_signalement || null,
    latitude || null,
    longitude || null,
    source || null,
    typeof synced === 'boolean' ? synced : null,
  ];

  const result = await db.query(query, params);
  const created = mapSignalementRow(result.rows[0]);

  // Handle photos (base64 data URLs or plain base64 strings)
  if (Array.isArray(data.photos) && data.photos.length > 0) {
    const uploadsRoot = path.join(__dirname, '..', 'uploads', 'signalements', String(created.id_signalement));
    fs.mkdirSync(uploadsRoot, { recursive: true });

    for (let i = 0; i < data.photos.length; i++) {
      try {
        const item = data.photos[i];
        if (!item) continue;

        // Parse data URL if present: data:[mime];base64,[data]
        let matches = null;
        let mime = 'image/jpeg';
        let base64data = item;
        if (typeof item === 'string' && item.startsWith('data:')) {
          matches = item.match(/^data:(.+);base64,(.+)$/);
          if (matches) {
            mime = matches[1];
            base64data = matches[2];
          }
        }

        // Determine extension
        let ext = '.jpg';
        if (mime === 'image/png') ext = '.png';
        else if (mime === 'image/webp') ext = '.webp';

        const filename = `photo-${i + 1}${ext}`;
        const filepath = path.join(uploadsRoot, filename);

        const buffer = Buffer.from(base64data, 'base64');
        fs.writeFileSync(filepath, buffer);

        // Store metadata in DB
        await db.query(
          'INSERT INTO signalement_photos (id_signalement, filename, path) VALUES ($1, $2, $3)',
          [created.id_signalement, filename, `/uploads/signalements/${created.id_signalement}/${filename}`]
        );
      } catch (e) {
        console.warn('Failed to save photo', e && e.message);
      }
    }
  }

  return created;
}

/**
 * Liste des signalements avec filtre optionnel par userId
 */
async function listSignalements(filters = {}) {
  const { userId } = filters;

  let query = `
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
  `;
  const params = [];

  if (userId) {
    params.push(userId);
    query += ' WHERE id_user = $1';
  }

  query += ' ORDER BY created_at DESC';

  const result = await db.query(query, params);
  return result.rows.map(mapSignalementRow);
}

/**
 * Récupérer un signalement par son ID
 */
async function getSignalementById(id) {
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
  const row = result.rows[0];
  const base = mapSignalementRow(row);
  if (!base) return null;

  // Récupérer les photos associées
  const photosRes = await db.query('SELECT filename, path, created_at FROM signalement_photos WHERE id_signalement = $1 ORDER BY id_photo ASC', [id]);
  base.photos = photosRes.rows.map(r => ({ filename: r.filename, url: r.path, created_at: r.created_at }));
  return base;
}

/**
 * Mettre à jour un signalement
 */
async function updateSignalement(id, data) {
  const {
    id_statut,
    id_entreprise,
    description,
    surface_m2,
    budget,
    date_signalement,
    latitude,
    longitude,
    source,
    synced,
  } = data;

  const query = `
    UPDATE signalements
    SET
      id_statut = COALESCE($2, id_statut),
      id_entreprise = COALESCE($3, id_entreprise),
      description = COALESCE($4, description),
      surface_m2 = COALESCE($5, surface_m2),
      budget = COALESCE($6, budget),
      date_signalement = COALESCE($7::date, date_signalement),
      geom = CASE
        WHEN $8 IS NOT NULL AND $9 IS NOT NULL THEN ST_SetSRID(ST_MakePoint($9::double precision, $8::double precision), 4326)
        ELSE geom
      END,
      source = COALESCE($10, source),
      synced = COALESCE($11, synced)
    WHERE id_signalement = $1
    RETURNING
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
      ST_X(geom) AS longitude;
  `;

  const params = [
    id,
    id_statut || null,
    id_entreprise || null,
    description || null,
    surface_m2 || null,
    budget || null,
    date_signalement || null,
    latitude || null,
    longitude || null,
    source || null,
    typeof synced === 'boolean' ? synced : null,
  ];

  const result = await db.query(query, params);
  return mapSignalementRow(result.rows[0]);
}

/**
 * Supprimer un signalement
 */
async function deleteSignalement(id) {
  await db.query('DELETE FROM signalements WHERE id_signalement = $1', [id]);
}

/**
 * Recherche les signalements dans une bounding box (pour Leaflet)
 */
async function findInBoundingBox(minLat, minLng, maxLat, maxLng) {
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
    WHERE geom IS NOT NULL
      AND ST_Within(
        geom,
        ST_MakeEnvelope($1::double precision, $2::double precision, $3::double precision, $4::double precision, 4326)
      )
    ORDER BY created_at DESC
  `;
  const result = await db.query(query, [minLng, minLat, maxLng, maxLat]);
  return result.rows.map(mapSignalementRow);
}

/**
 * Recherche les signalements proches d'un point (rayon en mètres)
 */
async function findNearby(lat, lng, radiusMeters = 1000) {
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
      ST_X(geom) AS longitude,
      ST_Distance(
        geom::geography,
        ST_SetSRID(ST_MakePoint($2::double precision, $1::double precision), 4326)::geography
      ) AS distance_meters
    FROM signalements
    WHERE geom IS NOT NULL
      AND ST_DWithin(
        geom::geography,
        ST_SetSRID(ST_MakePoint($2::double precision, $1::double precision), 4326)::geography,
        $3::double precision
      )
    ORDER BY distance_meters ASC
  `;
  const result = await db.query(query, [lat, lng, radiusMeters]);
  return result.rows.map(row => ({
    ...mapSignalementRow(row),
    distance_meters: parseFloat(row.distance_meters),
  }));
}

/**
 * Retourne les signalements au format GeoJSON FeatureCollection (pour Leaflet)
 */
async function getAsGeoJSON(filters = {}) {
  const { userId, statutId } = filters;
  
  let whereClause = 'WHERE geom IS NOT NULL';
  const params = [];
  
  if (userId) {
    params.push(userId);
    whereClause += ` AND id_user = $${params.length}`;
  }
  if (statutId) {
    params.push(statutId);
    whereClause += ` AND id_statut = $${params.length}`;
  }

  const query = `
    SELECT json_build_object(
      'type', 'FeatureCollection',
      'features', COALESCE(json_agg(
        json_build_object(
          'type', 'Feature',
          'id', id_signalement,
          'geometry', ST_AsGeoJSON(geom)::json,
          'properties', json_build_object(
            'id_signalement', id_signalement,
            'id_user', id_user,
            'id_statut', id_statut,
            'id_entreprise', id_entreprise,
            'description', description,
            'surface_m2', surface_m2,
            'budget', budget,
            'date_signalement', date_signalement,
            'source', source,
            'synced', synced,
            'created_at', created_at
          )
        )
      ), '[]'::json)
    ) AS geojson
    FROM signalements
    ${whereClause}
  `;

  const result = await db.query(query, params);
  return result.rows[0]?.geojson || { type: 'FeatureCollection', features: [] };
}

/**
 * Statistiques globales des signalements
 */
async function getStats() {
  const query = `
    SELECT
      COUNT(*) AS total,
      COUNT(*) FILTER (WHERE id_statut = 1) AS nouveau,
      COUNT(*) FILTER (WHERE id_statut = 2) AS en_cours,
      COUNT(*) FILTER (WHERE id_statut = 3) AS termine,
      COALESCE(SUM(surface_m2), 0) AS surface_totale,
      COALESCE(SUM(budget), 0) AS budget_total,
      COUNT(*) FILTER (WHERE synced = true) AS synced_count,
      COUNT(*) FILTER (WHERE synced = false OR synced IS NULL) AS not_synced_count
    FROM signalements
  `;
  const result = await db.query(query);
  const row = result.rows[0];
  return {
    total: parseInt(row.total, 10),
    par_statut: {
      nouveau: parseInt(row.nouveau, 10),
      en_cours: parseInt(row.en_cours, 10),
      termine: parseInt(row.termine, 10),
    },
    surface_totale: parseFloat(row.surface_totale),
    budget_total: parseFloat(row.budget_total),
    synchronisation: {
      synced: parseInt(row.synced_count, 10),
      not_synced: parseInt(row.not_synced_count, 10),
    },
  };
}

/**
 * Marquer des signalements comme synchronisés
 */
async function markAsSynced(ids) {
  if (!ids || ids.length === 0) return [];
  
  const query = `
    UPDATE signalements
    SET synced = true
    WHERE id_signalement = ANY($1)
    RETURNING id_signalement
  `;
  const result = await db.query(query, [ids]);
  return result.rows.map(r => r.id_signalement);
}

/**
 * Récupérer les signalements non synchronisés (pour sync offline -> online)
 */
async function getUnsyncedSignalements() {
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
    WHERE synced = false OR synced IS NULL
    ORDER BY created_at ASC
  `;
  const result = await db.query(query);
  return result.rows.map(mapSignalementRow);
}

module.exports = {
  createSignalement,
  listSignalements,
  getSignalementById,
  updateSignalement,
  deleteSignalement,
  findInBoundingBox,
  findNearby,
  getAsGeoJSON,
  getStats,
  markAsSynced,
  getUnsyncedSignalements,
};
