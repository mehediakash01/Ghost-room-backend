import { WebSocketGateway, WebSocketServer, OnGatewayConnection, OnGatewayDisconnect, SubscribeMessage, MessageBody, ConnectedSocket } from '@nestjs/websockets';
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
          this.server.to(roomId).emit('message:new', payload);
        } else if (type === 'room:deleted') {
          this.server.to(roomId).emit('room:deleted', payload);
        }
      }
    });
  }

  async handleConnection(client: Socket) {
    try {
      const token = client.handshake.query.token as string;
      const roomId = client.handshake.query.roomId as string;

      if (!token || !roomId) {
        client.disconnect(true);
        return;
      }

      const username = await this.sessionService.getSession(token);
      if (!username) {
        client.disconnect(true);
        return;
      }

      const room = await this.roomsService.findOne(roomId).catch(() => null);
      if (!room) {
        client.disconnect(true);
        return;
      }

      client.data.username = username;
      client.data.roomId = roomId;

      await client.join(roomId);

      await this.redisClient.sadd(`room:${roomId}:users`, username);
      const activeUsers = await this.redisClient.smembers(`room:${roomId}:users`);

      client.emit('room:joined', { activeUsers });
      this.server.to(roomId).emit('room:user_joined', { username, activeUsers });

    } catch (e) {
      client.disconnect(true);
    }
  }

  @SubscribeMessage('room:leave')
  async handleRoomLeave(@ConnectedSocket() client: Socket) {
    await this.handleDisconnect(client);
    client.disconnect(true);
  }

  async handleDisconnect(client: Socket) {
    const { username, roomId } = client.data;
    if (username && roomId) {
      const roomSockets = await this.server.in(roomId).fetchSockets();
      const hasOtherSockets = roomSockets.some(s => s.data.username === username && s.id !== client.id);

      if (!hasOtherSockets) {
        await this.redisClient.srem(`room:${roomId}:users`, username);
      }
      
      const activeUsers = await this.redisClient.smembers(`room:${roomId}:users`);
      this.server.to(roomId).emit('room:user_left', { username, activeUsers });
    }
  }
}
