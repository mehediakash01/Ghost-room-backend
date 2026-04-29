import { Module, Global } from '@nestjs/common';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

export const DB_CONNECTION = 'DB_CONNECTION';

@Global()
@Module({
  providers: [
    {
      provide: DB_CONNECTION,
      useFactory: () => {
        const pool = new Pool({
          connectionString: process.env.DATABASE_URL || 'postgres://postgres:password@localhost:5432/ghostroom',
        });
        return drizzle(pool, { schema });
      },
    },
  ],
  exports: [DB_CONNECTION],
})
export class DbModule {}
