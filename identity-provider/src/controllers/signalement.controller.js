const service = require('../services/signalement.service');
const localAuth = require('../services/auth.local.service');
const firebaseAuth = require('../services/auth.firebase.service');

/**
 * Créer un nouveau signalement
 */
exports.create = async (req, res) => {
  try {
    const body = { ...req.body };

    // Log de capture pour debug / audit
    console.log('[Signalements] create controller invoked', {
      time: new Date().toISOString(),
      user: req.user || null,
      body: req.body,
    });

    // Sanitize / cast des champs numériques et date
    body.latitude = typeof body.latitude !== 'undefined' ? (isFinite(Number(body.latitude)) ? Number(body.latitude) : null) : null;
    body.longitude = typeof body.longitude !== 'undefined' ? (isFinite(Number(body.longitude)) ? Number(body.longitude) : null) : null;
    body.surface_m2 = typeof body.surface_m2 !== 'undefined' ? (isFinite(Number(body.surface_m2)) ? Number(body.surface_m2) : null) : null;
    body.budget = typeof body.budget !== 'undefined' ? (isFinite(Number(body.budget)) ? Number(body.budget) : null) : null;
    body.date_signalement = body.date_signalement ? (isNaN(Date.parse(body.date_signalement)) ? null : body.date_signalement) : null;
    body.synced = typeof body.synced !== 'undefined' ? !!body.synced : null;

 
    if (!body.id_user && req.user) {
      // Cas local 
      if (req.user.id) {
        body.id_user = req.user.id;
      }

      // Cas Firebase 
      else if (req.user.uid) {
   
        let localUser = await localAuth.findByFirebaseUid(req.user.uid);
        if (!localUser) {
         
          localUser = await firebaseAuth.saveUserToLocalDb({
            uid: req.user.uid,
            email: req.user.email,
            password: null,
            firstname: req.user.name?.split(' ')[0] || '',
            lastname: req.user.name?.split(' ').slice(1).join(' ') || '',
          });
        }
        if (!localUser || !localUser.id) {
          throw new Error('Impossible de trouver ou créer l\'utilisateur local pour le uid Firebase');
        }
        body.id_user = localUser.id;

        body.source = body.source || 'FIREBASE';
      }
    }

    const signalement = await service.createSignalement(body);
    res.status(201).json(signalement);
  } catch (e) {
    console.error('[Signalements] create error:', e.message);
    res.status(400).json({ error: e.message });
  }
};


exports.list = async (req, res) => {
  try {
    const { userId } = req.query;
    const list = await service.listSignalements({ 
      userId: userId ? parseInt(userId, 10) : undefined 
    });
    res.json(list);
  } catch (e) {+
    console.error('[Signalements] list error:', e.message);
    res.status(500).json({ error: e.message });
  }
};


exports.getOne = async (req, res) => {
  try {
    const { id } = req.params;
    const sig = await service.getSignalementById(id);
    if (!sig) return res.status(404).json({ error: 'Signalement introuvable' });
    res.json(sig);
  } catch (e) {
    console.error('[Signalements] getOne error:', e.message);
    res.status(500).json({ error: e.message });
  }
};

exports.update = async (req, res) => {
  try {
    const { id } = req.params;
    console.log('[Signalements] update request:', { id, body: req.body });
    const updated = await service.updateSignalement(id, req.body || {});
    if (!updated) return res.status(404).json({ error: 'Signalement introuvable' });
    res.json(updated);
  } catch (e) {
    console.error('[Signalements] update error:', e.message, e.stack);
    res.status(400).json({ error: e.message });
  }
};


exports.remove = async (req, res) => {
  try {
    const { id } = req.params;
    await service.deleteSignalement(id);
    res.status(204).send();
  } catch (e) {
    console.error('[Signalements] delete error:', e.message);
    res.status(400).json({ error: e.message });
  }
};


exports.findInBbox = async (req, res) => {
  try {
    const { minLat, minLng, maxLat, maxLng } = req.query;
    if (!minLat || !minLng || !maxLat || !maxLng) {
      return res.status(400).json({ error: 'Paramètres requis: minLat, minLng, maxLat, maxLng' });
    }
    const list = await service.findInBoundingBox(
      parseFloat(minLat),
      parseFloat(minLng),
      parseFloat(maxLat),
      parseFloat(maxLng)
    );
    res.json(list);
  } catch (e) {
    console.error('[Signalements] bbox error:', e.message);
    res.status(500).json({ error: e.message });
  }
};

exports.findNearby = async (req, res) => {
  try {
    const { lat, lng, radius } = req.query;
    if (!lat || !lng) {
      return res.status(400).json({ error: 'Paramètres requis: lat, lng' });
    }
    const list = await service.findNearby(
      parseFloat(lat),
      parseFloat(lng),
      radius ? parseFloat(radius) : 1000
    );
    res.json(list);
  } catch (e) {
    console.error('[Signalements] nearby error:', e.message);
    res.status(500).json({ error: e.message });
  }
};

exports.getGeoJSON = async (req, res) => {
  try {
    const { userId, statutId } = req.query;
    const geojson = await service.getAsGeoJSON({
      userId: userId ? parseInt(userId, 10) : undefined,
      statutId: statutId ? parseInt(statutId, 10) : undefined,
    });
    res.json(geojson);
  } catch (e) {
    console.error('[Signalements] geojson error:', e.message);
    res.status(500).json({ error: e.message });
  }
};


exports.getStats = async (req, res) => {
  try {
    const stats = await service.getStats();
    res.json(stats);
  } catch (e) {
    console.error('[Signalements] stats error:', e.message);
    res.status(500).json({ error: e.message });
  }
};


exports.markSynced = async (req, res) => {
  try {
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids)) {
      return res.status(400).json({ error: 'ids (array) requis' });
    }
    const synced = await service.markAsSynced(ids);
    res.json({ synced_count: synced.length, ids: synced });
  } catch (e) {
    console.error('[Signalements] mark-synced error:', e.message);
    res.status(400).json({ error: e.message });
  }
};

exports.getUnsynced = async (req, res) => {
  try {
    const list = await service.getUnsyncedSignalements();
    res.json(list);
  } catch (e) {
    console.error('[Signalements] unsynced error:', e.message);
    res.status(500).json({ error: e.message });
  }
};
