const eventService = require('../services/eventService');
const queueWorker = require('../services/queueWorker');

/**
 * POST /api/v1/events
 * Validates the request, persists the event + pending notification,
 * pushes a task onto the background queue, and returns 202 immediately
 * without waiting for the notification to actually be "sent".
 */
function createEvent(req, res) {
  const { event_type, recipient, data } = req.body || {};

  if (!event_type || !recipient) {
    return res.status(400).json({ error: 'event_type and recipient are required' });
  }

  try {
    const { event_id, notification_id } = eventService.processEvent({
      event_type,
      recipient,
      data,
    });

    // Fire-and-forget: the worker processes this in the background.
    queueWorker.enqueue({ notification_id, event_id });

    return res.status(202).json({
      message: 'Event accepted for processing',
      tracking_id: event_id,
      notification_id,
      status: 'pending',
    });
  } catch (err) {
    console.error('[eventController] failed to process event:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

module.exports = { createEvent };
