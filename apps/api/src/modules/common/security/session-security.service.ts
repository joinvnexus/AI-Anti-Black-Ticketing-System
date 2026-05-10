import { Injectable, UnauthorizedException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';

@Injectable()
export class SessionSecurityService {
  constructor(private readonly databaseService: DatabaseService) {}

  async validate(input: { sessionId?: string; userId: string; deviceId: string }) {
    if (!input.sessionId || !this.databaseService.enabled) {
      return;
    }

    const result = await this.databaseService.query<{
      id: string;
      user_id: string;
      device_id: string;
      status: string;
      expires_at: Date;
    }>(
      `
        SELECT id, user_id, device_id, status, expires_at
        FROM sessions
        WHERE id = $1
      `,
      [input.sessionId],
    );

    const session = result.rows[0];

    if (
      !session ||
      session.user_id !== input.userId ||
      session.device_id !== input.deviceId ||
      session.status !== 'active' ||
      session.expires_at.getTime() <= Date.now()
    ) {
      throw new UnauthorizedException('Invalid session binding');
    }
  }
}
