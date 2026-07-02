# Event-Driven Notification Dispatcher

A lightweight asynchronous notification system built with **Express.js**, **Node.js**, and **SQLite**. The API accepts a business event (e.g. `order_placed`), persists it, queues a notification task, and responds immediately with `202 Accepted` — while a background worker simulates sending the notification and updates its status without ever blocking the HTTP response.

## Project Overview

1. A client calls `POST /api/v1/events` with an event type, recipient, and payload data.
2. The API validates the request, saves the event to the `events` table, and creates a `pending` row in the `notifications` table.
3. The notification task is pushed onto an in-memory queue.
4. The API immediately responds with `202 Accepted` and a `tracking_id` — it does **not** wait for the notification to actually be sent.
5. A background worker (running inside the same Node.js process) picks tasks off the queue, simulates sending the notification with a random 500–1000ms delay and a ~10% chance of failure, and updates the notification's status to `completed` or `failed` (incrementing `retry_count` on failure).

See `architecture-diagram.png` for the full request/worker flow.

## Tech Stack

| Layer            | Technology                          |
|-------------------|--------------------------------------|
| Runtime           | Node.js 22.5+ (tested on Node 22/24) |
| Web framework     | Express.js                           |
| Database          | SQLite (via Node's built-in `node:sqlite` module) |
| Queue             | In-memory array queue + async worker loop (no Redis/RabbitMQ/Kafka/BullMQ) |
| Config            | `dotenv`                             |

## Project Structure

```
project-root/
├── src/
│   ├── app.js                     # Express app, middleware, error handlers
│   ├── server.js                  # Entry point: loads env, inits DB, starts server
│   ├── controllers/
│   │   └── eventController.js     # Request validation + orchestration
│   ├── services/
│   │   ├── eventService.js        # Event + notification persistence (DB transaction)
│   │   ├── notificationService.js # Notification CRUD (create/markCompleted/markFailed)
│   │   └── queueWorker.js         # In-memory queue + background worker loop
│   ├── db/
│   │   ├── database.js            # SQLite connection + schema bootstrap
│   │   └── schema.sql             # Table definitions
│   └── routes/
│       └── eventRoutes.js         # POST /api/v1/events route
├── architecture-diagram.png
├── package.json
├── README.md
└── .env.example
```

## Installing Dependencies

Requires Node.js **22.5+** (tested on Node 22 and 24), since the project uses Node's built-in `node:sqlite` module rather than a native npm SQLite driver — no C++ build toolchain (Visual Studio Build Tools / Xcode CLI tools) is required to install.

```bash
cd project-root
npm install
```

This installs `express` and `dotenv`. SQLite support comes from Node itself.

## Setting Up the Database

No manual setup is required. On startup, `server.js` calls `initSchema()`, which runs `src/db/schema.sql` against the SQLite file automatically (creating the `data/` folder and the `.db` file if they don't exist yet).

By default the database is created at `./data/notifications.db`. You can change this via the `DB_PATH` environment variable.

## Running the Application

1. Copy the example environment file:
   ```bash
   cp .env.example .env
   ```
2. Install dependencies (see above).
3. Start the server:
   ```bash
   npm start
   ```
   You should see:
   ```
   Event-Driven Notification Dispatcher listening on port 3000
   ```
4. (Optional) For auto-restart on file changes during development:
   ```bash
   npm run dev
   ```

## API Endpoint

### `POST /api/v1/events`

Triggers a business event and queues a notification for it.

**Request body**

```json
{
  "event_type": "order_placed",
  "recipient": "user@example.com",
  "data": {
    "order_id": 101
  }
}
```

**Success response — `202 Accepted`**

```json
{
  "message": "Event accepted for processing",
  "tracking_id": 1,
  "notification_id": 1,
  "status": "pending"
}
```

**Validation error — `400 Bad Request`** (missing `event_type` or `recipient`)

```json
{
  "error": "event_type and recipient are required"
}
```

**Invalid JSON body — `400 Bad Request`**

```json
{
  "error": "Invalid JSON payload"
}
```

**Server error — `500 Internal Server Error`**

```json
{
  "error": "Internal server error"
}
```

### Sample `curl` request

```bash
curl -X POST https://event-driven-notification-dispatcher-8jy6.onrender.com/api/v1/events \
  -H "Content-Type: application/json" \
  -d '{
    "event_type": "order_placed",
    "recipient": "user@example.com",
    "data": {
      "order_id": 101
    }
  }'
```

The response returns instantly. A few hundred milliseconds later, check the `notifications` table (or your server logs) and you'll see the row for `notification_id: 1` move from `pending` to either `completed` or `failed`.

## How the Asynchronous Queue Works

- `queueWorker.js` keeps a simple in-memory array (`queue`) — no external broker.
- `enqueue(task)` pushes a `{ notification_id, event_id }` object onto the array. If the worker loop isn't already running, it starts `processQueue()`.
- `processQueue()` is an `async` loop that repeatedly `shift()`s the next task off the front of the array, `await`s a simulated send (`setTimeout` with a random 500–1000ms delay), and then updates the notification's status in SQLite:
  - ~90% of the time: `status = 'completed'`.
  - ~10% of the time: `status = 'failed'`, `retry_count` incremented by 1.
- Because `enqueue()` is called and then the controller returns its response **without awaiting** the worker, the `202 Accepted` response is sent to the client immediately, while the actual "sending" and DB update happen afterward, in the background, within the same Node.js event loop.
- The queue processes tasks sequentially (one at a time) in the order they were received, which is simple to reason about and sufficient for this assignment. It could trivially be extended to a small worker pool for concurrent processing.

## Assumptions and Limitations

- **In-memory queue is not durable.** If the process crashes or restarts while tasks are queued, those pending tasks are lost (though the `notifications` row remains `pending` in the DB, so it could be re-queued on startup — not implemented here since the assignment explicitly asks for a native/in-memory queue rather than a persistent broker).
- **Single channel.** Only the `email` channel is used, per the assignment's requirement; the schema supports other channels if extended later.
- **No retry scheduling.** `retry_count` is incremented on failure, but the assignment doesn't require automatically re-queuing failed notifications, so this implementation records the failure and stops. Automatic retry with backoff would be a natural next step.
- **Single-process only.** The queue lives in the Node.js process's memory, so this design assumes a single running instance. Horizontally scaling the API would require moving to a shared/external queue (explicitly out of scope for this assignment).
- **`node:sqlite` is experimental** (stable since Node 22.5, still flagged as experimental by Node itself as of this writing). It's synchronous, like `better-sqlite3`, which keeps the code simple but is worth knowing about for very high-throughput scenarios. It was chosen over `better-sqlite3`/`sqlite3` specifically to avoid requiring a native C++ build toolchain on the machine running this project.
- **`npm install` requires internet access** to download `express` and `dotenv` from the npm registry.
- **Requires Node.js 22.5 or newer.** Older Node versions don't include `node:sqlite` and would need `better-sqlite3` (and a C++ build toolchain) instead.

## Deploying to Render

This repository includes `render.yaml` and `Dockerfile` so you can deploy the app to Render with persistent disk support.

1. Push the repository to GitHub.
2. In the Render dashboard, create a new Web Service and connect your GitHub repo.
3. Use the existing `render.yaml` file, or configure the service manually as follows:
   - Environment: `Node`
   - Build Command: `npm install`
   - Start Command: `npm start`
   - Health Check Path: `/health`
4. Set environment variables in Render if needed:
   - `PORT=3000`
   - `DB_PATH=./data/notifications.db`
5. Render Web Services provide a persistent disk for the app, so the local SQLite file at `./data/notifications.db` will persist across restarts.

If you prefer, Render can also build from the provided `Dockerfile` instead of using the Node environment directly.
