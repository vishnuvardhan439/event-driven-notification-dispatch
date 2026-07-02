const notificationService = require('./notificationService');

// Simple in-memory, array-based queue. No Redis / RabbitMQ / Kafka / BullMQ.
const queue = [];
let isProcessing = false;

const MIN_DELAY_MS = Number(process.env.WORKER_MIN_DELAY_MS) || 500;
const MAX_DELAY_MS = Number(process.env.WORKER_MAX_DELAY_MS) || 1000;
const FAILURE_RATE = Number(process.env.WORKER_FAILURE_RATE) || 0.1;

/**
 * Add a notification task to the queue. If the worker loop isn't already
 * running, kick it off. The caller (controller) never awaits this.
 */
function enqueue(task) {
  queue.push(task);
  if (!isProcessing) {
    processQueue();
  }
}

function randomDelay() {
  return Math.floor(Math.random() * (MAX_DELAY_MS - MIN_DELAY_MS + 1)) + MIN_DELAY_MS;
}

/**
 * Simulate sending a notification (e.g. an email provider call) with a
 * random delay and a ~10% chance of failure.
 */
function simulateSend() {
  return new Promise((resolve) => {
    const delay = randomDelay();
    setTimeout(() => {
      const failed = Math.random() < FAILURE_RATE;
      resolve(!failed);
    }, delay);
  });
}

/**
 * Drain the queue one task at a time. Runs in the background and is never
 * awaited by the HTTP request/response cycle.
 */
async function processQueue() {
  isProcessing = true;

  while (queue.length > 0) {
    const task = queue.shift();
    const { notification_id } = task;

    try {
      const success = await simulateSend();

      if (success) {
        notificationService.markCompleted(notification_id);
        console.log(`[worker] notification ${notification_id} completed`);
      } else {
        notificationService.markFailed(notification_id);
        console.log(`[worker] notification ${notification_id} failed (retry_count incremented)`);
      }
    } catch (err) {
      // Covers both "sending" failures and DB update failures.
      console.error(`[worker] error processing notification ${notification_id}:`, err.message);
      try {
        notificationService.markFailed(notification_id);
      } catch (updateErr) {
        console.error(
          `[worker] could not update notification ${notification_id} after error:`,
          updateErr.message
        );
      }
    }
  }

  isProcessing = false;
}

module.exports = { enqueue };
