/**
 * Service de notifications
 * Gère l'envoi de notifications pour les changements de statut des signalements
 * Supporte les notifications in-app et push (FCM)
 */

const db = require('../config/database');
const { initFirebase } = require('../config/firebase');

// Initialiser Firebase Admin
const admin = initFirebase();

// ============================================
// GESTION DES TOKENS FCM
// ============================================

/**
 * Enregistrer ou mettre à jour un token FCM pour un utilisateur
 */
async function registerFcmToken(userId, fcmToken, deviceType = 'mobile') {
  const query = `
    INSERT INTO user_fcm_tokens (id_user, fcm_token, device_type, updated_at)
    VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
    ON CONFLICT (id_user, fcm_token) 
    DO UPDATE SET updated_at = CURRENT_TIMESTAMP, device_type = $3
    RETURNING *
  `;
  const result = await db.query(query, [userId, fcmToken, deviceType]);
  return result.rows[0];
}

/**
 * Supprimer un token FCM (déconnexion)
 */
async function removeFcmToken(userId, fcmToken) {
  await db.query(
    'DELETE FROM user_fcm_tokens WHERE id_user = $1 AND fcm_token = $2',
    [userId, fcmToken]
  );
}

/**
 * Récupérer tous les tokens FCM d'un utilisateur
 */
async function getUserFcmTokens(userId) {
  const result = await db.query(
    'SELECT fcm_token FROM user_fcm_tokens WHERE id_user = $1',
    [userId]
  );
  return result.rows.map(r => r.fcm_token);
}

// ============================================
// CRÉATION DE NOTIFICATIONS
// ============================================

/**
 * Créer une notification in-app
 */
async function createNotification(data) {
  const { id_user, id_signalement, type, title, message, extraData } = data;

  const query = `
    INSERT INTO notifications (id_user, id_signalement, type, title, message, data)
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING *
  `;
  const result = await db.query(query, [
    id_user,
    id_signalement,
    type,
    title,
    message,
    extraData ? JSON.stringify(extraData) : null,
  ]);
  return result.rows[0];
}

/**
 * Notifier un changement de statut d'un signalement
 * C'est la fonction principale appelée quand un statut change
 */
async function notifyStatusChange(signalementId, oldStatus, newStatus, managerId = null) {
  try {
    // Récupérer les infos du signalement et de l'utilisateur propriétaire
    const sigQuery = `
      SELECT 
        s.id_signalement,
        s.id_user,
        s.description,
        u.email,
        u.firstname,
        old_st.libelle AS old_status_label,
        new_st.libelle AS new_status_label
      FROM signalements s
      JOIN users u ON s.id_user = u.id
      LEFT JOIN statuts_signalement old_st ON old_st.id_statut = $2
      LEFT JOIN statuts_signalement new_st ON new_st.id_statut = $3
      WHERE s.id_signalement = $1
    `;
    const sigResult = await db.query(sigQuery, [signalementId, oldStatus, newStatus]);
    
    if (sigResult.rows.length === 0) {
      console.warn('[Notifications] Signalement non trouvé:', signalementId);
      return null;
    }

    const sig = sigResult.rows[0];
    
    // Construire le message de notification
    const title = 'Mise à jour de votre signalement';
    const message = `Le statut de votre signalement "${truncate(sig.description, 50)}" est passé de "${sig.old_status_label || 'Inconnu'}" à "${sig.new_status_label || 'Inconnu'}"`;

    const notificationData = {
      id_signalement: signalementId,
      old_status: oldStatus,
      new_status: newStatus,
      old_status_label: sig.old_status_label,
      new_status_label: sig.new_status_label,
      changed_by: managerId,
      changed_at: new Date().toISOString(),
    };

    // 1. Créer la notification in-app
    const notification = await createNotification({
      id_user: sig.id_user,
      id_signalement: signalementId,
      type: 'STATUS_CHANGE',
      title,
      message,
      extraData: notificationData,
    });

    // 2. Envoyer une notification push via FCM
    await sendPushNotification(sig.id_user, {
      title,
      body: message,
      data: notificationData,
    });

    // 3. Enregistrer dans l'historique des statuts
    await recordStatusHistory(signalementId, newStatus, managerId);

    console.log('[Notifications] Status change notified:', {
      signalement: signalementId,
      user: sig.id_user,
      from: sig.old_status_label,
      to: sig.new_status_label,
    });

    return notification;
  } catch (error) {
    console.error('[Notifications] Error notifying status change:', error.message);
    throw error;
  }
}

/**
 * Enregistrer le changement de statut dans l'historique
 */
async function recordStatusHistory(signalementId, newStatus, managerId) {
  const query = `
    INSERT INTO historique_statuts (id_signalement, id_statut, id_manager)
    VALUES ($1, $2, $3)
  `;
  await db.query(query, [signalementId, newStatus, managerId]);
}

// ============================================
// ENVOI DE NOTIFICATIONS PUSH (FCM)
// ============================================

/**
 * Envoyer une notification push à un utilisateur via Firebase Cloud Messaging
 */
async function sendPushNotification(userId, notification) {
  try {
    const tokens = await getUserFcmTokens(userId);
    
    if (tokens.length === 0) {
      console.log('[Notifications] No FCM tokens for user:', userId);
      return { success: false, reason: 'NO_TOKENS' };
    }

    const message = {
      notification: {
        title: notification.title,
        body: notification.body,
      },
      data: notification.data ? stringifyData(notification.data) : {},
      tokens: tokens,
    };

    // Envoyer via Firebase Admin SDK
    const response = await admin.messaging().sendEachForMulticast(message);
    
    console.log('[Notifications] FCM response:', {
      successCount: response.successCount,
      failureCount: response.failureCount,
    });

    // Nettoyer les tokens invalides
    if (response.failureCount > 0) {
      await cleanupInvalidTokens(userId, tokens, response.responses);
    }

    return {
      success: response.successCount > 0,
      successCount: response.successCount,
      failureCount: response.failureCount,
    };
  } catch (error) {
    console.error('[Notifications] FCM error:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Nettoyer les tokens FCM invalides
 */
async function cleanupInvalidTokens(userId, tokens, responses) {
  const invalidCodes = [
    'messaging/invalid-registration-token',
    'messaging/registration-token-not-registered',
  ];

  for (let i = 0; i < responses.length; i++) {
    if (!responses[i].success && invalidCodes.includes(responses[i].error?.code)) {
      await removeFcmToken(userId, tokens[i]);
      console.log('[Notifications] Removed invalid token for user:', userId);
    }
  }
}

// ============================================
// LECTURE DES NOTIFICATIONS
// ============================================

/**
 * Récupérer les notifications d'un utilisateur
 */
async function getUserNotifications(userId, options = {}) {
  const { limit = 50, offset = 0, unreadOnly = false } = options;

  let query = `
    SELECT 
      n.*,
      s.description AS signalement_description,
      st.libelle AS current_status
    FROM notifications n
    LEFT JOIN signalements s ON n.id_signalement = s.id_signalement
    LEFT JOIN statuts_signalement st ON s.id_statut = st.id_statut
    WHERE n.id_user = $1
  `;
  const params = [userId];

  if (unreadOnly) {
    query += ' AND n.read = false';
  }

  query += ' ORDER BY n.created_at DESC LIMIT $2 OFFSET $3';
  params.push(limit, offset);

  const result = await db.query(query, params);
  return result.rows;
}

/**
 * Compter les notifications non lues
 */
async function getUnreadCount(userId) {
  const result = await db.query(
    'SELECT COUNT(*) AS count FROM notifications WHERE id_user = $1 AND read = false',
    [userId]
  );
  return parseInt(result.rows[0].count, 10);
}

/**
 * Marquer une notification comme lue
 */
async function markAsRead(notificationId, userId) {
  const result = await db.query(
    `UPDATE notifications 
     SET read = true, read_at = CURRENT_TIMESTAMP 
     WHERE id = $1 AND id_user = $2
     RETURNING *`,
    [notificationId, userId]
  );
  return result.rows[0];
}

/**
 * Marquer toutes les notifications comme lues
 */
async function markAllAsRead(userId) {
  await db.query(
    `UPDATE notifications 
     SET read = true, read_at = CURRENT_TIMESTAMP 
     WHERE id_user = $1 AND read = false`,
    [userId]
  );
}

// ============================================
// HELPERS
// ============================================

/**
 * Tronquer une chaîne
 */
function truncate(str, maxLength) {
  if (!str) return '';
  if (str.length <= maxLength) return str;
  return str.substring(0, maxLength - 3) + '...';
}

/**
 * Convertir les valeurs en strings pour FCM data payload
 */
function stringifyData(obj) {
  const result = {};
  for (const [key, value] of Object.entries(obj)) {
    result[key] = typeof value === 'string' ? value : JSON.stringify(value);
  }
  return result;
}

module.exports = {
  // Tokens FCM
  registerFcmToken,
  removeFcmToken,
  getUserFcmTokens,
  
  // Création de notifications
  createNotification,
  notifyStatusChange,
  
  // Push notifications
  sendPushNotification,
  
  // Lecture
  getUserNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
};
