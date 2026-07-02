
const express = require('express');
const { createEvent } = require('../controllers/eventController');

const router = express.Router();

// GET /api/v1
// Returns API documentation for the v1 namespace.
router.get('/', (req, res) => {
  const baseUrl = `${req.protocol}://${req.get('host')}`;

  res.status(200).json({
    title: 'Event-Driven Notification Dispatcher API v1',
    endpoints: [
      {
        method: 'POST',
        path: '/api/v1/events',
        description: 'Create a new event and queue a notification for processing.',
        request_body: {
          event_type: 'string (required)',
          recipient: 'string (required)',
          data: 'object (optional)'
        },
        example_body: {
          event_type: 'order_placed',
          recipient: 'user@example.com',
          data: { order_id: 101, amount: 49.99 }
        },
        curl_example: `curl -X POST ${baseUrl}/api/v1/events -H 'Content-Type: application/json' -d '{"event_type":"order_placed","recipient":"user@example.com","data":{"order_id":101,"amount":49.99}}'`,
        success_response: {
          message: 'Event accepted for processing',
          tracking_id: 'number',
          notification_id: 'number',
          status: 'pending'
        }
      }
    ]
  });
});

// POST /api/v1/events
router.post('/events', createEvent);

// GET /api/v1/events
// Returns a helpful message in the browser for users visiting this endpoint directly.
router.get('/events', (req, res) => {
  res.status(200).json({
    message: 'This endpoint accepts POST requests only. Send a JSON body with event_type, recipient, and optional data.',
    example: {
      event_type: 'order_placed',
      recipient: 'user@example.com',
      data: { order_id: 101 }
    },
    note: 'Use POST /api/v1/events to submit data. GET /api/v1/events is only for documentation.'
  });
});

module.exports = router;
