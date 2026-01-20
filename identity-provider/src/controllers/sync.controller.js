const syncService = require('../services/sync.service');
const selector = require('../services/auth.selector');

/**
 * Synchronisation bidirectionnelle complète (Firebase <-> PostgreSQL)
 */
exports.syncAll = async (req, res) => {
  try {
    // Vérifier si on est en ligne
    const online = await selector.isOnline();
    if (!online) {
      return res.status(503).json({
        error: 'Firebase inaccessible. La synchronisation nécessite une connexion internet.',
        online: false,
      });
    }

    console.log('[Sync Controller] Démarrage synchronisation bidirectionnelle...');
    const report = await syncService.syncAll();

    res.json({
      success: true,
      message: 'Synchronisation bidirectionnelle terminée',
      report,
    });
  } catch (error) {
    console.error('[Sync Controller] Erreur syncAll:', error.message);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Synchronisation Firebase -> PostgreSQL uniquement
 */
exports.syncFromFirebase = async (req, res) => {
  try {
    const online = await selector.isOnline();
    if (!online) {
      return res.status(503).json({
        error: 'Firebase inaccessible. La synchronisation nécessite une connexion internet.',
        online: false,
      });
    }

    console.log('[Sync Controller] Démarrage synchronisation Firebase -> PostgreSQL...');
    const report = await syncService.syncFirebaseToLocal();

    res.json({
      success: true,
      message: 'Synchronisation Firebase -> PostgreSQL terminée',
      direction: 'firebase-to-local',
      report,
    });
  } catch (error) {
    console.error('[Sync Controller] Erreur syncFromFirebase:', error.message);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Synchronisation PostgreSQL -> Firebase uniquement
 */
exports.syncToFirebase = async (req, res) => {
  try {
    const online = await selector.isOnline();
    if (!online) {
      return res.status(503).json({
        error: 'Firebase inaccessible. La synchronisation nécessite une connexion internet.',
        online: false,
      });
    }

    console.log('[Sync Controller] Démarrage synchronisation PostgreSQL -> Firebase...');
    const report = await syncService.syncLocalToFirebase();

    res.json({
      success: true,
      message: 'Synchronisation PostgreSQL -> Firebase terminée',
      direction: 'local-to-firebase',
      report,
    });
  } catch (error) {
    console.error('[Sync Controller] Erreur syncToFirebase:', error.message);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Afficher les statistiques de synchronisation
 */
exports.syncStatus = async (req, res) => {
  try {
    const online = await selector.isOnline();
    
    // Récupérer les utilisateurs locaux
    const localUsers = await syncService.getLocalUsers();
    
    const stats = {
      online,
      localUsers: {
        total: localUsers.length,
        withFirebaseUid: localUsers.filter(u => u.firebase_uid).length,
        withoutFirebaseUid: localUsers.filter(u => !u.firebase_uid).length,
        syncedFromFirebase: localUsers.filter(u => u.synced_from_firebase).length,
      },
      firebaseUsers: null,
    };

    // Si en ligne, récupérer aussi les stats Firebase
    if (online) {
      try {
        const firebaseUsers = await syncService.getFirebaseUsers();
        stats.firebaseUsers = {
          total: firebaseUsers.length,
        };
        
        // Calculer les utilisateurs non synchronisés
        const localEmails = new Set(localUsers.map(u => u.email));
        const firebaseEmails = new Set(firebaseUsers.map(u => u.email));
        
        stats.comparison = {
          onlyInFirebase: firebaseUsers.filter(u => !localEmails.has(u.email)).length,
          onlyInLocal: localUsers.filter(u => !firebaseEmails.has(u.email)).length,
          inBoth: localUsers.filter(u => firebaseEmails.has(u.email)).length,
        };
      } catch (error) {
        stats.firebaseError = error.message;
      }
    }

    res.json(stats);
  } catch (error) {
    console.error('[Sync Controller] Erreur syncStatus:', error.message);
    res.status(500).json({ error: error.message });
  }
};
