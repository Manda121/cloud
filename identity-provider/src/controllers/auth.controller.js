const localAuth = require('../services/auth.local.service');
const firebaseAuth = require('../services/auth.firebase.service');
const selector = require('../services/auth.selector');

/**
 * Inscription - utilise Firebase si en ligne, sinon local PostgreSQL
 * Dans tous les cas, l'utilisateur est aussi enregistré dans PostgreSQL
 */
exports.register = async (req, res) => {
  try {
    const { email, password, firstname, lastname } = req.body;
    
    // Vérifier si on est en ligne (Firebase accessible)
    const online = await selector.isOnline();
    
    let result;
    let mode;
    
    if (online && selector.useFirebase()) {
      // Mode ONLINE: utiliser Firebase et synchroniser avec PostgreSQL local
      mode = 'firebase';
      console.log('[Auth Controller] Inscription en mode ONLINE (Firebase + PostgreSQL)');
      
      if (email && password) {
        result = await firebaseAuth.serverSignUp(email, password, firstname, lastname);
        // La sauvegarde locale est déjà faite dans serverSignUp
      } else {
        result = await firebaseAuth.register(req.body);
        // La sauvegarde locale est déjà faite dans register
      }
    } else {
      // Mode OFFLINE: utiliser uniquement PostgreSQL local
      mode = 'local';
      console.log('[Auth Controller] Inscription en mode OFFLINE (PostgreSQL uniquement)');
      result = await localAuth.register(req.body);
    }

    res.json({ 
      ...result, 
      authMode: mode,
      message: mode === 'firebase' 
        ? 'Inscription réussie (Firebase + local)' 
        : 'Inscription réussie (local uniquement - sera synchronisé quand en ligne)'
    });
  } catch (e) {
    console.error('[Auth Controller] Erreur inscription:', e.message);
    res.status(400).json({ error: e.message });
  }
};

/**
 * Connexion - utilise Firebase si en ligne, sinon PostgreSQL local
 */
exports.login = async (req, res) => {
  try {
    const { idToken, email, password } = req.body;
    const authMode = process.env.AUTH_MODE || 'auto';
    
    // Si AUTH_MODE est explicitement défini comme 'firebase', forcer Firebase (pas de fallback local)
    const forceFirebase = authMode === 'firebase';
    
    // Si email+password provided et local user has a local password ET mode 'auto', prefer local login
    if (!forceFirebase && email && password) {
      const localUser = await localAuth.findByEmail(email);
      if (localUser && localUser.password) {
        console.log('[Auth Controller] Connexion en mode LOCAL (utilisateur local détecté)');
        const result = await localAuth.login(email, password);
        return res.json({
          ...result,
          authMode: 'local',
          message: 'Connexion en mode local (utilisateur local)'
        });
      }
    }

    // Vérifier si on est en ligne
    const online = await selector.isOnline();
    
    if (online && selector.useFirebase()) {
      console.log('[Auth Controller] Connexion en mode ONLINE (Firebase)');
      
      // Mode ONLINE avec Firebase
      if (idToken) {
        const decoded = await firebaseAuth.verifyIdToken(idToken);
        return res.json({ 
          token: idToken, 
          uid: decoded.uid, 
          email: decoded.email,
          authMode: 'firebase'
        });
      }

      if (email && password) {
        const data = await firebaseAuth.serverSignIn(email, password);
        const decoded = await firebaseAuth.verifyIdToken(data.idToken);
        
        // S'assurer que l'utilisateur existe aussi en local pour le mode offline futur
        await firebaseAuth.saveUserToLocalDb({
          uid: decoded.uid,
          email: decoded.email,
          password: password,
          firstname: decoded.name?.split(' ')[0] || '',
          lastname: decoded.name?.split(' ').slice(1).join(' ') || '',
        });
        
        return res.json({ 
          token: data.idToken, 
          uid: decoded.uid, 
          email: decoded.email,
          authMode: 'firebase'
        });
      }

      return res.status(400).json({ error: 'Fournir idToken ou email+password' });
    }
    
    // Mode OFFLINE: utiliser PostgreSQL local
    console.log('[Auth Controller] Connexion en mode OFFLINE (PostgreSQL)');
    
    if (!email || !password) {
      return res.status(400).json({ error: 'Email et mot de passe requis pour le mode hors ligne' });
    }
    
    const result = await localAuth.login(email, password);
    return res.json({ 
      ...result,
      authMode: 'local',
      message: 'Connexion en mode hors ligne'
    });
    
  } catch (e) {
    console.error('[Auth Controller] Erreur connexion:', e.message);
    res.status(401).json({ error: e.message });
  }
};

/**
 * Débloquer un compte (local uniquement)
 */
exports.unblock = async (req, res) => {
  try {
    await localAuth.unblockUser(req.body.email);
    res.json({ message: 'Compte débloqué' });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
};

/**
 * Vérifier le statut de connectivité et le mode d'authentification actuel
 */
exports.status = async (req, res) => {
  try {
    const online = await selector.isOnline();
    const mode = await selector.getCurrentAuthMode();
    
    res.json({
      online,
      authMode: mode,
      useFirebase: selector.useFirebase(),
      configuredMode: process.env.AUTH_MODE || 'auto'
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

/**
 * Forcer le rafraîchissement du cache de connectivité
 */
exports.refreshConnectivity = async (req, res) => {
  try {
    selector.resetConnectivityCache();
    const online = await selector.isOnline();
    res.json({ 
      message: 'Cache de connectivité rafraîchi',
      online,
      authMode: online ? 'firebase' : 'local'
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

/**
 * Générer un custom token Firebase pour le client mobile/web
 * POST /api/auth/custom-token
 * Le client doit être authentifié (token local ou Firebase)
 * Le custom token retourné permet au client de s'authentifier sur Firebase avec :
 *   firebase.auth().signInWithCustomToken(customToken)
 */
exports.getCustomToken = async (req, res) => {
  try {
    const syncService = require('../services/sync.service');

    // L'utilisateur doit être authentifié (middleware auth)
    if (!req.user) {
      return res.status(401).json({ error: 'Non authentifié' });
    }

    // Déterminer l'UID Firebase à utiliser
    let uid = req.user.uid; // Firebase UID si auth Firebase
    
    if (!uid && req.user.id) {
      // Auth locale : utiliser l'email comme UID ou créer un UID déterministe
      const localUser = await localAuth.findById(req.user.id);
      if (localUser && localUser.firebase_uid) {
        uid = localUser.firebase_uid;
      } else {
        // Créer un UID déterministe à partir de l'email
        uid = `local_${req.user.id}_${(localUser?.email || '').replace(/[^a-zA-Z0-9]/g, '_')}`;
      }
    }

    if (!uid) {
      return res.status(400).json({ error: 'Impossible de déterminer l\'UID utilisateur' });
    }

    // Claims additionnels
    const claims = {
      localUserId: req.user.id || null,
      email: req.user.email || null,
      provider: req.userProvider || 'unknown',
    };

    const customToken = await syncService.generateCustomToken(uid, claims);

    console.log(`[Auth] Custom token generated for UID: ${uid}`);

    res.json({
      success: true,
      customToken,
      uid,
      message: 'Utilisez firebase.auth().signInWithCustomToken(customToken) côté client',
    });
  } catch (e) {
    console.error('[Auth] Custom token error:', e.message);
    res.status(500).json({ error: e.message });
  }
};
