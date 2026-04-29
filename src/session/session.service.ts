import { Injectable, Inject } from '@nestjs/common';
import { REDIS_CLIENT } from '../redis/redis.module';
import { Redis } from 'ioredis';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class SessionService {
  constructor(@Inject(REDIS_CLIENT) private readonly redisClient: Redis) {}

  async createSession(userId: number): Promise<string> {
    const sessionToken = uuidv4();
    // Set TTL to 24 hours (86400 seconds)
    await this.redisClient.set(`session:${sessionToken}`, userId, 'EX', 86400);
    return sessionToken;
  }

  async getSession(sessionToken: string): Promise<number | null> {
    const userIdStr = await this.redisClient.get(`session:${sessionToken}`);
    return userIdStr ? parseInt(userIdStr, 10) : null;
  }
}
