import { Injectable, Inject, NotFoundException, ForbiddenException } from '@nestjs/common';
import { DB_CONNECTION } from '../db/db.module';
import { REDIS_CLIENT } from '../redis/redis.module';
import * as schema from '../db/schema';
import { eq, desc, and, lt } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Redis } from 'ioredis';

@Injectable()
export class RoomsService {
  constructor(
    @Inject(DB_CONNECTION) private readonly db: NodePgDatabase<typeof schema>,
    @Inject(REDIS_CLIENT) private readonly redisClient: Redis,
  ) {}

  private async getActiveUsers(roomId: string): Promise<string[]> {
    const users = await this.redisClient.smembers(`room:${roomId}:users`);
    return users;
  }

  async createRoom(name: string, username: string) {
    const [room] = await this.db.insert(schema.rooms).values({
      name,
      createdBy: username,
    }).returning();
    
    return { ...room, activeUsers: 0 };
  }

  async findAll() {
    const rooms = await this.db.query.rooms.findMany({
      orderBy: [desc(schema.rooms.createdAt)],
    });

    const roomsWithCounts = await Promise.all(rooms.map(async (room) => {
      const activeUsers = await this.getActiveUsers(room.id);
      return { ...room, activeUsers: activeUsers.length };
    }));

    return roomsWithCounts;
  }

  async findOne(id: string) {
    const room = await this.db.query.rooms.findFirst({
      where: eq(schema.rooms.id, id),
    });

    if (!room) {
      throw new NotFoundException('Room not found');
    }

    const activeUsers = await this.getActiveUsers(room.id);
    return { ...room, activeUsers: activeUsers.length };
  }

  async deleteRoom(id: string, username: string) {
    const room = await this.db.query.rooms.findFirst({
      where: eq(schema.rooms.id, id),
    });

    if (!room) {
      throw new NotFoundException('Room not found');
    }

    if (room.createdBy !== username) {
      throw new ForbiddenException('You can only delete rooms you created');
    }

    await this.db.delete(schema.rooms).where(eq(schema.rooms.id, id));

    await this.redisClient.publish('internal_events', JSON.stringify({
      type: 'room:deleted',
      roomId: id,
      payload: { message: 'Room deleted' }
    }));

    return { message: 'Room deleted' };
  }

  async getMessages(roomId: string, before?: string) {
    const limit = 50; 
    
    const messages = await this.db.query.messages.findMany({
      where: before 
        ? and(eq(schema.messages.roomId, roomId), lt(schema.messages.id, before))
        : eq(schema.messages.roomId, roomId),
      orderBy: [desc(schema.messages.id)],
      limit,
    });

    return messages;
  }

  async createMessage(roomId: string, username: string, content: string) {
    const trimmedContent = content.trim();

    const room = await this.db.query.rooms.findFirst({
      where: eq(schema.rooms.id, roomId),
    });

    if (!room) {
      throw new NotFoundException('Room not found');
    }

    const [message] = await this.db.insert(schema.messages).values({
      roomId,
      username,
      content: trimmedContent,
    }).returning();

    await this.redisClient.publish('internal_events', JSON.stringify({
      type: 'message:new',
      roomId,
      payload: message
    }));

    return message;
  }
}
