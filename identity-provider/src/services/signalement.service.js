const db = require('../config/database');

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
 * Construction dynamique - aucun paramètre NULL
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

  // Construction dynamique des colonnes et valeurs
  const columns = ['id_user', 'id_statut', 'description'];
  const valuePlaceholders = [];
  const params = [];
  let idx = 1;

  // id_user (requis)
  valuePlaceholders.push(`$${idx++}`);
  params.push(id_user);

  // id_statut (défaut = 1)
  valuePlaceholders.push(`$${idx++}`);
  params.push(id_statut ? parseInt(id_statut, 10) : 1);

  // description (requis)
  valuePlaceholders.push(`$${idx++}`);
  params.push(description);

  // id_entreprise (optionnel)
  if (id_entreprise != null) {
    columns.push('id_entreprise');
    valuePlaceholders.push(`$${idx++}`);
    params.push(parseInt(id_entreprise, 10));
  }

  // surface_m2 (optionnel)
  if (surface_m2 != null) {
    columns.push('surface_m2');
    valuePlaceholders.push(`$${idx++}`);
    params.push(parseFloat(surface_m2));
  }

  // budget (optionnel)
  if (budget != null) {
    columns.push('budget');
    valuePlaceholders.push(`$${idx++}`);
    params.push(parseFloat(budget));
  }

  // date_signalement
  columns.push('date_signalement');
  if (date_signalement) {
    valuePlaceholders.push(`$${idx++}::date`);
    params.push(date_signalement);
  } else {
    valuePlaceholders.push('CURRENT_DATE');
  }

  // geom (seulement si lat/lng fournis)
  if (latitude != null && longitude != null) {
    columns.push('geom');
    valuePlaceholders.push(`ST_SetSRID(ST_MakePoint($${idx}, $${idx + 1}), 4326)`);
    params.push(parseFloat(longitude));
    params.push(parseFloat(latitude));
    idx += 2;
  }

  // source
  columns.push('source');
  if (source) {
    valuePlaceholders.push(`$${idx++}`);
    params.push(source);
  } else {
    valuePlaceholders.push("'LOCAL'");
  }

  // synced
  columns.push('synced');
  if (typeof synced === 'boolean') {
    valuePlaceholders.push(`$${idx++}`);
    params.push(synced);
  } else {
    valuePlaceholders.push('false');
  }

  const query = `
    INSERT INTO signalements (${columns.join(', ')})
    VALUES (${valuePlaceholders.join(', ')})
    RETURNING
      id_signalement, id_user, id_statut, id_entreprise,
      description, surface_m2, budget, date_signalement,
      source, synced, created_at,
      ST_Y(geom) AS latitude, ST_X(geom) AS longitude;
  `;

  console.log('[CREATE] Query:', query);
  console.log('[CREATE] Params:', params);

  const result = await db.query(query, params);
  return mapSignalementRow(result.rows[0]);
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
  return mapSignalementRow(result.rows[0]);
}

/**
 * Mettre à jour un signalement
 * Approche dynamique : on ne met à jour que les champs fournis
 */
async function updateSignalement(id, data) {
  const updates = [];
  const params = [id]; // $1 = id
  let paramIndex = 2;

  // id_statut
  if (data.id_statut !== undefined && data.id_statut !== null) {
    updates.push(`id_statut = $${paramIndex}`);
    params.push(parseInt(data.id_statut, 10));
    paramIndex++;
  }

  // id_entreprise
  if (data.id_entreprise !== undefined && data.id_entreprise !== null) {
    updates.push(`id_entreprise = $${paramIndex}`);
    params.push(parseInt(data.id_entreprise, 10));
    paramIndex++;
  }

  // description
  if (data.description !== undefined && data.description !== null) {
    updates.push(`description = $${paramIndex}`);
    params.push(data.description);
    paramIndex++;
  }

  // surface_m2
  if (data.surface_m2 !== undefined && data.surface_m2 !== null) {
    updates.push(`surface_m2 = $${paramIndex}`);
    params.push(parseFloat(data.surface_m2));
    paramIndex++;
  }

  // budget
  if (data.budget !== undefined && data.budget !== null) {
    updates.push(`budget = $${paramIndex}`);
    params.push(parseFloat(data.budget));
    paramIndex++;
  }

  // date_signalement
  if (data.date_signalement !== undefined && data.date_signalement !== null) {
    updates.push(`date_signalement = $${paramIndex}::date`);
    params.push(data.date_signalement);
    paramIndex++;
  }

  // geom (latitude + longitude ensemble)
  if (data.latitude !== undefined && data.latitude !== null && 
      data.longitude !== undefined && data.longitude !== null) {
    updates.push(`geom = ST_SetSRID(ST_MakePoint($${paramIndex}::double precision, $${paramIndex + 1}::double precision), 4326)`);
    params.push(parseFloat(data.longitude)); // X = longitude
    params.push(parseFloat(data.latitude));  // Y = latitude
    paramIndex += 2;
  }

  // source
  if (data.source !== undefined && data.source !== null) {
    updates.push(`source = $${paramIndex}`);
    params.push(data.source);
    paramIndex++;
  }

  // synced
  if (typeof data.synced === 'boolean') {
    updates.push(`synced = $${paramIndex}`);
    params.push(data.synced);
    paramIndex++;
  }

  // Si aucun champ à mettre à jour, retourner le signalement existant
  if (updates.length === 0) {
    return getSignalementById(id);
  }

  const query = `
    UPDATE signalements
    SET ${updates.join(', ')}
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

  console.log('[Signalement Service] UPDATE query:', query);
  console.log('[Signalement Service] UPDATE params:', params);

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
