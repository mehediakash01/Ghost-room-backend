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

  private async getActiveUsersCount(roomId: number): Promise<number> {
    const count = await this.redisClient.scard(`room:${roomId}:users`);
    return count;
  }

  async createRoom(name: string, userId: number) {
    const [room] = await this.db.insert(schema.rooms).values({
      name,
      createdBy: userId,
    }).returning();
    
    return { ...room, activeUsers: 0 };
  }

  async findAll() {
    const rooms = await this.db.query.rooms.findMany({
      orderBy: [desc(schema.rooms.createdAt)],
    });

    const roomsWithCounts = await Promise.all(rooms.map(async (room) => {
      const activeUsers = await this.getActiveUsersCount(room.id);
      return { ...room, activeUsers };
    }));

    return roomsWithCounts;
  }

  async findOne(id: number) {
    const room = await this.db.query.rooms.findFirst({
      where: eq(schema.rooms.id, id),
    });

    if (!room) {
      throw new NotFoundException('Room not found');
    }

    const activeUsers = await this.getActiveUsersCount(room.id);
    return { ...room, activeUsers };
  }

  async deleteRoom(id: number, userId: number) {
    const room = await this.db.query.rooms.findFirst({
      where: eq(schema.rooms.id, id),
    });

    if (!room) {
      throw new NotFoundException('Room not found');
    }

    if (room.createdBy !== userId) {
      throw new ForbiddenException('You can only delete rooms you created');
    }

    await this.db.delete(schema.rooms).where(eq(schema.rooms.id, id));

    await this.redisClient.publish('internal_events', JSON.stringify({
      type: 'room:deleted',
      roomId: id,
      payload: { roomId: id }
    }));

    return { deleted: true, roomId: id };
  }

  async getMessages(roomId: number, before?: number) {
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

  async createMessage(roomId: number, userId: number, content: string) {
    const trimmedContent = content.trim();

    const room = await this.db.query.rooms.findFirst({
      where: eq(schema.rooms.id, roomId),
    });

    if (!room) {
      throw new NotFoundException('Room not found');
    }

    const [message] = await this.db.insert(schema.messages).values({
      roomId,
      userId,
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
