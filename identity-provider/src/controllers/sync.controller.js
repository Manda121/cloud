/**
 * Contrôleur de synchronisation Firebase <-> PostgreSQL
 */

const syncService = require('../services/sync.service');
const selector = require('../services/auth.selector');

/**
 * Pull - Récupérer les signalements depuis Firebase vers PostgreSQL
 */
async function pull(req, res) {
  try {
    // Vérifier si Firebase est accessible
    const isOnline = await selector.isOnline();
    if (!isOnline) {
      return res.status(503).json({
        success: false,
        error: 'Firebase n\'est pas accessible. Synchronisation impossible.'
      });
    }

    const result = await syncService.pullFromFirebase();
    
    res.json({
      success: true,
      message: `Synchronisation terminée: ${result.created.length} créés, ${result.updated.length} mis à jour`,
      data: result
    });
  } catch (err) {
    console.error('[Sync Controller] Erreur pull:', err.message);
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
}

/**
 * Push - Pousser les signalements PostgreSQL vers Firebase
 */
async function push(req, res) {
  try {
    const isOnline = await selector.isOnline();
    if (!isOnline) {
      return res.status(503).json({
        success: false,
        error: 'Firebase n\'est pas accessible. Synchronisation impossible.'
      });
    }

    const result = await syncService.pushToFirebase();
    
    res.json({
      success: true,
      message: `${result.pushed.length} signalements poussés vers Firebase`,
      data: result
    });
  } catch (err) {
    console.error('[Sync Controller] Erreur push:', err.message);
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
}

/**
 * Trigger - Déclencher une synchronisation manuelle
 */
async function trigger(req, res) {
  try {
    const { direction = 'both' } = req.body;
    
    const isOnline = await selector.isOnline();
    if (!isOnline) {
      return res.status(503).json({
        success: false,
        error: 'Firebase n\'est pas accessible. Synchronisation impossible.'
      });
    }

    const result = await syncService.triggerSync(direction);
    
    let message = 'Synchronisation terminée';
    if (result.pull) {
      message += ` | Pull: ${result.pull.created.length} créés, ${result.pull.updated.length} mis à jour`;
    }
    if (result.push) {
      message += ` | Push: ${result.push.pushed.length} envoyés`;
    }

    res.json({
      success: true,
      message,
      data: result
    });
  } catch (err) {
    console.error('[Sync Controller] Erreur trigger:', err.message);
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
}

/**
 * Stats - Récupérer les statistiques de synchronisation
 */
async function stats(req, res) {
  try {
    const data = await syncService.getSyncStats();
    res.json({
      success: true,
      data
    });
  } catch (err) {
    console.error('[Sync Controller] Erreur stats:', err.message);
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
}

module.exports = {
  pull,
  push,
  trigger,
  stats
};
