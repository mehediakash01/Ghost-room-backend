import { Injectable, Inject } from '@nestjs/common';
import { DB_CONNECTION } from '../db/db.module';
import { SessionService } from '../session/session.service';
import * as schema from '../db/schema';
import { eq } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';

@Injectable()
export class AuthService {
  constructor(
    @Inject(DB_CONNECTION) private readonly db: NodePgDatabase<typeof schema>,
    private readonly sessionService: SessionService,
  ) {}

  async login(username: string) {
    let user = await this.db.query.users.findFirst({
      where: eq(schema.users.username, username),
    });

    if (!user) {
      const [newUser] = await this.db.insert(schema.users).values({ username }).returning();
      user = newUser;
    }

    const sessionToken = await this.sessionService.createSession(user.id);

    return {
      user,
      sessionToken,
    };
  }
}
