const { db } = require('../db/database');
const notificationService = require('./notificationService');

const DEFAULT_CHANNEL = 'email';

function insertEvent({ event_type, recipient, data }) {
  const payload = JSON.stringify({ recipient, data: data || {} });
  const stmt = db.prepare(`
    INSERT INTO events (event_type, payload)
    VALUES (?, ?)
  `);
  const result = stmt.run(event_type, payload);
  return result.lastInsertRowid;
}

/**
 * Persist the event and its associated pending notification in a single
 * DB transaction, so we never end up with one row without the other.
 * Returns { event_id, notification_id }.
 */
function processEvent({ event_type, recipient, data }) {
  db.exec('BEGIN');
  try {
    const event_id = insertEvent({ event_type, recipient, data });
    const notification_id = notificationService.createNotification({
      event_id,
      recipient,
      channel: DEFAULT_CHANNEL,
    });
    db.exec('COMMIT');
    return { event_id, notification_id };
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

module.exports = { processEvent };
