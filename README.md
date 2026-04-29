# GhostRoom API 👻

A highly scalable, real-time anonymous chat backend powered by NestJS, PostgreSQL, Redis, and Socket.IO. 

## Features
- Custom opaque session tokens via Redis.
- Cursor-based message pagination for infinite scrolling.
- Real-time event broadcasting and presence tracking.
- Fully typed using Drizzle ORM and Zod.
- Multi-instance ready (Horizontal scaling via Redis Pub/Sub Adapter).

## Prerequisites
- [Node.js](https://nodejs.org/) (v18+)
- [Docker](https://www.docker.com/) & Docker Compose

## Quick Start

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Spin up the Environment (PostgreSQL & Redis)**
   ```bash
   docker-compose up -d
   ```

3. **Sync Database Schema**
   ```bash
   npm run db:push
   ```

4. **Start the Development Server**
   ```bash
   npm run start:dev
   ```

The REST API will be running on `http://localhost:3000/api/v1` and the WebSocket server connects at `ws://localhost:3000/chat`.

---

## REST API Documentation

*All success responses are wrapped in `{"success": true, "data": { ... }}`.*

### Authentication

**Login / Create User**
- `POST /api/v1/login`
- **Body**: `{ "username": "ghost_player_1" }`
- **Returns**: `{ "user": { ... }, "sessionToken": "uuid-..." }`

### Rooms
*Note: Pass the session token in the `Authorization: Bearer <token>` header.*

**List all rooms**
- `GET /api/v1/rooms`
- **Returns**: Array of rooms with their real-time `activeUsers` count.

**Create a room**
- `POST /api/v1/rooms`
- **Body**: `{ "name": "Spooky Lounge" }`

**Get specific room**
- `GET /api/v1/rooms/:id`

**Delete a room**
- `DELETE /api/v1/rooms/:id`
- *Must be the original creator to delete.*

### Messages

**Send a message**
- `POST /api/v1/rooms/:id/messages`
- **Body**: `{ "content": "Hello there!" }`

**Get messages (Cursor Pagination)**
- `GET /api/v1/rooms/:id/messages?before=msg_12345`

---

## WebSocket API Documentation

Connect to the `chat` namespace:
`ws://localhost:3000/chat?token=YOUR_SESSION_TOKEN&roomId=room_12345`

### Client -> Server Events
- `room:leave`: Explicitly leave the room without closing the entire TCP connection.

### Server -> Client Events
- `room:joined`: Received upon successful connection.
  - Payload: `{ "activeUsers": ["ghost_player_1", "another_user"] }`
- `room:user_joined`: Broadcasted when someone enters.
  - Payload: `{ "username": "ghost_player_1", "activeUsers": [...] }`
- `room:user_left`: Broadcasted when someone leaves.
  - Payload: `{ "username": "ghost_player_1", "activeUsers": [...] }`
- `message:new`: Broadcasted when a new message is sent via REST.
  - Payload: `{ "id": "msg_...", "username": "...", "content": "...", "createdAt": "..." }`
- `room:deleted`: Broadcasted when the creator deletes the room.
  - Payload: `{ "message": "Room deleted" }`
