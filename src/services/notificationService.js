const { db } = require('../db/database');

/**
 * Insert a new notification row with status = 'pending'.
 * Returns the newly created notification_id.
 */
function createNotification({ event_id, recipient, channel = 'email' }) {
  const stmt = db.prepare(`
    INSERT INTO notifications (event_id, recipient, channel, status)
    VALUES (?, ?, ?, 'pending')
  `);
  const result = stmt.run(event_id, recipient, channel);
  return result.lastInsertRowid;
}

/**
 * Mark a notification as completed (used by the queue worker on success).
 */
function markCompleted(notification_id) {
  const stmt = db.prepare(`
    UPDATE notifications
    SET status = 'completed', updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `);
  const result = stmt.run(notification_id);
  if (result.changes === 0) {
    throw new Error(`Notification ${notification_id} not found while marking completed`);
  }
}

/**
 * Mark a notification as failed and bump retry_count
 * (used by the queue worker on simulated failure).
 */
function markFailed(notification_id) {
  const stmt = db.prepare(`
    UPDATE notifications
    SET status = 'failed', retry_count = retry_count + 1, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `);
  const result = stmt.run(notification_id);
  if (result.changes === 0) {
    throw new Error(`Notification ${notification_id} not found while marking failed`);
  }
}

module.exports = { createNotification, markCompleted, markFailed };
