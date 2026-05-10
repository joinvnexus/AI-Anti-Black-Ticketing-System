import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool, QueryResult, QueryResultRow } from 'pg';

@Injectable()
export class DatabaseService implements OnModuleDestroy {
  private readonly logger = new Logger(DatabaseService.name);
  private readonly pool: Pool | null;

  constructor(configService: ConfigService) {
    const connectionString = configService.get<string>('DATABASE_URL');

    if (!connectionString) {
      this.pool = null;
      this.logger.warn('DATABASE_URL is not set; API is running without PostgreSQL');
      return;
    }

    this.pool = new Pool({
      connectionString,
    });
  }

  get enabled() {
    return this.pool !== null;
  }

  async query<T extends QueryResultRow>(text: string, values: unknown[] = []) {
    if (!this.pool) {
      throw new Error('Database not configured');
    }

    return this.pool.query(text, values) as Promise<QueryResult<T>>;
  }

  async onModuleDestroy() {
    if (this.pool) {
      await this.pool.end();
    }
  }
}
