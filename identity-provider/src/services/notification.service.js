const db = require('../config/database');

/**
 * Créer une notification
 */
async function createNotification({ id_user, id_signalement, type, title, message }) {
  const query = `
    INSERT INTO notifications (id_user, id_signalement, type, title, message)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING id_notification AS id, id_user, id_signalement, type, title, message, is_read AS "read", created_at
  `;
  const result = await db.query(query, [id_user, id_signalement, type || 'STATUS_CHANGE', title, message]);
  return result.rows[0];
}

/**
 * Récupérer les notifications d'un utilisateur
 */
async function getNotificationsByUser(userId, { limit = 50, unreadOnly = false } = {}) {
  let query = `
    SELECT 
      n.id_notification AS id,
      n.id_user,
      n.id_signalement,
      n.type,
      n.title,
      n.message,
      n.is_read AS "read",
      n.created_at,
      s.description as signalement_description,
      ST_Y(s.geom) AS latitude,
      ST_X(s.geom) AS longitude
    FROM notifications n
    LEFT JOIN signalements s ON n.id_signalement = s.id_signalement
    WHERE n.id_user = $1
  `;
  const params = [userId];

  if (unreadOnly) {
    query += ' AND n.is_read = false';
  }

  query += ' ORDER BY n.created_at DESC LIMIT $' + (params.length + 1);
  params.push(limit);

  const result = await db.query(query, params);
  return result.rows;
}

/**
 * Compter les notifications non lues
 */
async function getUnreadCount(userId) {
  const result = await db.query(
    'SELECT COUNT(*) as count FROM notifications WHERE id_user = $1 AND is_read = false',
    [userId]
  );
  return parseInt(result.rows[0].count, 10);
}

/**
 * Marquer une notification comme lue
 */
async function markAsRead(notificationId, userId) {
  const result = await db.query(
    'UPDATE notifications SET is_read = true WHERE id_notification = $1 AND id_user = $2 RETURNING id_notification AS id, id_user, id_signalement, type, title, message, is_read AS "read", created_at',
    [notificationId, userId]
  );
  return result.rows[0];
}

/**
 * Marquer toutes les notifications comme lues
 */
async function markAllAsRead(userId) {
  const result = await db.query(
    'UPDATE notifications SET is_read = true WHERE id_user = $1 AND is_read = false RETURNING id_notification AS id',
    [userId]
  );
  return result.rows.length;
}

/**
 * Créer une notification de changement de statut
 */
async function notifyStatusChange(signalement, oldStatus, newStatus) {
  const statusLabels = { 1: 'Nouveau', 2: 'En cours', 3: 'Terminé' };
  const newStatusLabel = statusLabels[Number(newStatus)] || 'Inconnu';
  const oldStatusLabel = statusLabels[Number(oldStatus)] || 'Inconnu';

  const coords = signalement.latitude && signalement.longitude
    ? `(${Number(signalement.latitude).toFixed(4)}, ${Number(signalement.longitude).toFixed(4)})`
    : '';

  const title = `Statut modifié → ${newStatusLabel}`;
  const message = `Le signalement "${signalement.description || 'Sans description'}" ${coords} est passé de "${oldStatusLabel}" à "${newStatusLabel}".`;

  return createNotification({
    id_user: signalement.id_user,
    id_signalement: signalement.id_signalement,
    type: 'STATUS_CHANGE',
    title,
    message,
  });
}

module.exports = {
  createNotification,
  getNotificationsByUser,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  notifyStatusChange,
};
