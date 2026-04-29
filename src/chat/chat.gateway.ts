import { WebSocketGateway, WebSocketServer, OnGatewayConnection, OnGatewayDisconnect } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { SessionService } from '../session/session.service';
import { RoomsService } from '../rooms/rooms.service';
import { REDIS_CLIENT } from '../redis/redis.module';
import { Inject } from '@nestjs/common';
import { Redis } from 'ioredis';

@WebSocketGateway({ namespace: 'chat', cors: { origin: '*' } })
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private subClient: Redis;

  constructor(
    private sessionService: SessionService,
    private roomsService: RoomsService,
    @Inject(REDIS_CLIENT) private redisClient: Redis,
  ) {
    this.subClient = this.redisClient.duplicate();
    this.subClient.subscribe('internal_events');
    this.subClient.on('message', (channel, message) => {
      if (channel === 'internal_events') {
        const { type, roomId, payload } = JSON.parse(message);
        if (type === 'message:new') {
          this.server.to(roomId.toString()).emit('message:new', payload);
        } else if (type === 'room:deleted') {
          this.server.to(roomId.toString()).emit('room:deleted', payload);
        }
      }
    });
  }

  async handleConnection(client: Socket) {
    try {
      const token = client.handshake.query.token as string;
      const roomIdStr = client.handshake.query.roomId as string;

      if (!token || !roomIdStr) {
        client.disconnect(true);
        return;
      }

      const userId = await this.sessionService.getSession(token);
      if (!userId) {
        client.disconnect(true);
        return;
      }

      const roomId = parseInt(roomIdStr, 10);
      const room = await this.roomsService.findOne(roomId).catch(() => null);
      if (!room) {
        client.disconnect(true);
        return;
      }

      client.data.userId = userId;
      client.data.roomId = roomId;

      await client.join(roomId.toString());

      await this.redisClient.sadd(`room:${roomId}:users`, userId);

      client.emit('room:joined', { roomId, userId });
      this.server.to(roomId.toString()).emit('room:user_joined', { roomId, userId });

    } catch (e) {
      client.disconnect(true);
    }
  }

  async handleDisconnect(client: Socket) {
    const { userId, roomId } = client.data;
    if (userId && roomId) {
      const roomSockets = await this.server.in(roomId.toString()).fetchSockets();
      const hasOtherSockets = roomSockets.some(s => s.data.userId === userId && s.id !== client.id);

      if (!hasOtherSockets) {
        await this.redisClient.srem(`room:${roomId}:users`, userId);
      }
      this.server.to(roomId.toString()).emit('room:user_left', { roomId, userId });
    }
  }
}
