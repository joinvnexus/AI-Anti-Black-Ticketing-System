import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';

type AuditRecordInput = {
  actorUserId?: string | null;
  action: string;
  resourceType: string;
  resourceId?: string | null;
  outcome: 'success' | 'rejected' | 'failed';
  metadata?: Record<string, unknown>;
};

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);
  private readonly fallbackLogs: AuditRecordInput[] = [];

  constructor(private readonly databaseService: DatabaseService) {}

  async record(input: AuditRecordInput) {
    if (!this.databaseService.enabled) {
      this.fallbackLogs.push(input);
      this.logger.log(`AUDIT ${input.action} ${input.outcome} ${input.resourceType}:${input.resourceId ?? '-'}`);
      return;
    }

    await this.databaseService.query(
      `
        INSERT INTO audit_logs (actor_user_id, action, resource_type, resource_id, outcome, metadata)
        VALUES ($1, $2, $3, $4, $5, $6::jsonb)
      `,
      [
        input.actorUserId ?? null,
        input.action,
        input.resourceType,
        input.resourceId ?? null,
        input.outcome,
        JSON.stringify(input.metadata ?? {}),
      ],
    );
  }
}
