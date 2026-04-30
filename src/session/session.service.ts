import { Injectable, Inject } from '@nestjs/common';
import { REDIS_CLIENT } from '../redis/redis.module';
import { Redis } from 'ioredis';
import { randomUUID } from 'crypto';

@Injectable()
export class SessionService {
  constructor(@Inject(REDIS_CLIENT) private readonly redisClient: Redis) {}

  async createSession(username: string): Promise<string> {
    const sessionToken = randomUUID();
    await this.redisClient.set(`session:${sessionToken}`, username, 'EX', 86400);
    return sessionToken;
  }

  async getSession(sessionToken: string): Promise<string | null> {
    return await this.redisClient.get(`session:${sessionToken}`);
  }
}
