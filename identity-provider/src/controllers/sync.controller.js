/**
 * Contrôleur de synchronisation Firebase <-> PostgreSQL
 * Gère les endpoints pour la synchronisation des signalements
 */

const syncService = require('../services/sync.service');

/**
 * Récupérer les données depuis Firebase
 * GET /api/sync/pull
 */
exports.pullFromFirebase = async (req, res) => {
  try {
    console.log('[Sync] Pull from Firebase requested');
    
    const result = await syncService.pullFromFirebase();
    
    res.json({
      success: true,
      message: 'Synchronisation Firebase → Local terminée',
      data: result,
    });
  } catch (error) {
    console.error('[Sync] Pull error:', error.message);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

/**
 * Envoyer les données vers Firebase
 * POST /api/sync/push
 */
exports.pushToFirebase = async (req, res) => {
  try {
    console.log('[Sync] Push to Firebase requested');
    
    const result = await syncService.pushAllUnsyncedToFirebase();
    
    res.json({
      success: true,
      message: 'Synchronisation Local → Firebase terminée',
      data: result,
    });
  } catch (error) {
    console.error('[Sync] Push error:', error.message);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

/**
 * Déclencher une synchronisation manuelle complète
 * POST /api/sync/trigger
 * Body: { direction: 'pull' | 'push' | 'both' }
 */
exports.triggerSync = async (req, res) => {
  try {
    const { direction = 'both' } = req.body;
    
    console.log(`[Sync] Manual sync triggered: ${direction}`);
    
    if (!['pull', 'push', 'both'].includes(direction)) {
      return res.status(400).json({
        success: false,
        error: "Direction invalide. Utilisez 'pull', 'push' ou 'both'",
      });
    }
    
    const result = await syncService.triggerManualSync(direction);
    
    res.json({
      success: true,
      message: `Synchronisation ${direction} terminée`,
      data: result,
    });
  } catch (error) {
    console.error('[Sync] Trigger error:', error.message);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

/**
 * Récupérer les conflits en attente de résolution
 * GET /api/sync/conflicts
 */
exports.getConflicts = async (req, res) => {
  try {
    const conflicts = await syncService.getPendingConflicts();
    
    res.json({
      success: true,
      count: conflicts.length,
      data: conflicts,
    });
  } catch (error) {
    console.error('[Sync] Get conflicts error:', error.message);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

/**
 * Résoudre un conflit
 * POST /api/sync/conflicts/:id/resolve
 * Body: { resolution: 'LOCAL' | 'FIREBASE' }
 */
exports.resolveConflict = async (req, res) => {
  try {
    const { id } = req.params;
    const { resolution } = req.body;
    
    if (!resolution || !['LOCAL', 'FIREBASE'].includes(resolution)) {
      return res.status(400).json({
        success: false,
        error: "Resolution invalide. Utilisez 'LOCAL' ou 'FIREBASE'",
      });
    }
    
    console.log(`[Sync] Resolving conflict ${id} with ${resolution}`);
    
    const result = await syncService.resolveConflict(id, resolution);
    
    res.json({
      success: true,
      message: `Conflit résolu avec la version ${resolution}`,
      data: result,
    });
  } catch (error) {
    console.error('[Sync] Resolve conflict error:', error.message);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

/**
 * Récupérer l'historique des synchronisations
 * GET /api/sync/history
 * Query: ?limit=50
 */
exports.getSyncHistory = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit, 10) || 50;
    
    const history = await syncService.getSyncHistory(limit);
    
    res.json({
      success: true,
      count: history.length,
      data: history,
    });
  } catch (error) {
    console.error('[Sync] Get history error:', error.message);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

/**
 * Récupérer les erreurs de synchronisation
 * GET /api/sync/errors
 * Query: ?limit=20
 */
exports.getSyncErrors = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit, 10) || 20;
    
    const errors = await syncService.getSyncErrors(limit);
    
    res.json({
      success: true,
      count: errors.length,
      data: errors,
    });
  } catch (error) {
    console.error('[Sync] Get errors error:', error.message);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

/**
 * Récupérer les statistiques de synchronisation
 * GET /api/sync/stats
 */
exports.getSyncStats = async (req, res) => {
  try {
    const stats = await syncService.getSyncStats();
    
    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    console.error('[Sync] Get stats error:', error.message);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};
