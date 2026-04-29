# GhostRoom Architecture

GhostRoom is a robust, horizontally scalable real-time anonymous chat API built with NestJS. This document outlines the core architectural decisions, data flows, and scaling strategies.

## High-Level Architecture
The application follows a monolithic, highly decoupled modular architecture powered by NestJS.
1. **REST API**: Handles synchronous operations like user creation, login, room management, and message persistence.
2. **WebSocket Gateway**: Handles real-time bi-directional events for chat presence and message distribution.
3. **Internal Pub/Sub Bridge**: Ensures that interactions via the REST API (like sending a message) are seamlessly broadcasted out to the connected WebSocket clients.

## Technology Stack
- **Framework**: [NestJS](https://nestjs.com/) (Node.js)
- **Database**: [PostgreSQL 15](https://www.postgresql.org/)
- **ORM**: [Drizzle ORM](https://orm.drizzle.team/) for extreme type-safety and performance.
- **In-Memory Store**: [Redis 7](https://redis.io/) (via `ioredis`) for Session management, Pub/Sub, and Presence tracking.
- **Real-Time**: [Socket.IO](https://socket.io/)
- **Validation**: [Zod](https://zod.dev/)

## Authentication (Custom Opaque Tokens)
JWTs are completely avoided to allow instant session revocation.
1. When a user hits `/api/v1/login`, `uuidv4` generates a highly secure Opaque Token.
2. The token is mapped directly to the `username` in **Redis** with a 24-hour TTL (`EX 86400`).
3. The `AuthGuard` extracts this token via `Bearer <token>` and performs an instantaneous `GET session:<token>` lookup in Redis, making auth incredibly fast without hitting PostgreSQL.

## Database Schema Design
All IDs are strictly typed `varchar` custom strings prefixed for clarity (`usr_...`, `room_...`, `msg_...`).

- **users**: `id` (PK), `username` (Unique), `createdAt`
- **rooms**: `id` (PK), `name`, `createdBy` (FK -> users.username), `createdAt`
- **messages**: `id` (PK), `roomId` (FK -> rooms.id), `username` (FK -> users.username), `content`, `createdAt`

## Real-Time Scaling Strategy
GhostRoom is specifically engineered to be horizontally scalable out of the box. 

### 1. Redis IO Adapter
If GhostRoom is deployed across multiple containers/servers, a client connected to `Server A` needs to be able to talk to a client on `Server B`. By integrating `@socket.io/redis-adapter` into the NestJS lifecycle, all WebSocket broadcasts are inherently synced across all servers using Redis.

### 2. The Internal Bridge (Decoupling)
When a user POSTs a message to the REST API, the REST controller does **not** talk directly to the Socket.IO instance. 
Instead, it publishes the payload to a Redis channel (`internal_events`). The `ChatGateway` acts as a subscriber to this channel. Upon receiving an event, it safely delegates the broadcast to the specific room. This enforces separation of concerns and guarantees messages aren't lost across instances.

### 3. Presence Tracking (Active Users)
To determine exactly how many unique users are in a room, we utilize **Redis Sets** (`room:<id>:users`).
- On connect, `sadd` adds the `username` to the set.
- Since it is a Set, if a user opens multiple browser tabs, they are only counted once.
- On disconnect, the gateway queries other active sockets. Only if the user has closed *all* tabs are they removed via `srem`.

## Data Retrieval
- **Cursor-Based Pagination**: Fetching messages uses cursor-based pagination utilizing the message `id`. Unlike traditional `OFFSET`/`LIMIT` pagination which degrades in performance, indexing over `id < cursor` ensures instantaneous lookup regardless of table size.
- **Global Envelopes**: A strict Global Interceptor and Global Exception Filter are implemented at the highest level of the application. This ensures that 100% of REST responses enforce the `{ "success": boolean, "data": ... }` or `{ "success": false, "error": ... }` contract without controller bloat.
