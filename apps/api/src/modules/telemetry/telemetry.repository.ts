import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

@Injectable()
export class TelemetryRepository {
  constructor(private readonly databaseService: DatabaseService) {}

  get enabled() {
    return this.databaseService.enabled;
  }

  async create(input: {
    userId?: string;
    sessionId?: string;
    deviceId: string;
    journeyId?: string;
    mouseMovements: number;
    clickCount: number;
    typingSpeedCpm: number;
    focusSwitchCount: number;
    pasteCount: number;
    hesitationScore: number;
    formFillMs: number;
    pageDwellMs: number;
    riskHint: number;
    rawPayload: Record<string, unknown>;
  }) {
    const result = await this.databaseService.query<{ id: string; created_at: Date }>(
      `
        INSERT INTO telemetry_snapshots (
          user_id, session_id, device_id, journey_id, mouse_movements, click_count, typing_speed_cpm,
          focus_switch_count, paste_count, hesitation_score, form_fill_ms, page_dwell_ms, risk_hint, raw_payload
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14::jsonb)
        RETURNING id, created_at
      `,
      [
        input.userId ?? null,
        input.sessionId ?? null,
        input.deviceId,
        input.journeyId ?? null,
        input.mouseMovements,
        input.clickCount,
        input.typingSpeedCpm,
        input.focusSwitchCount,
        input.pasteCount,
        input.hesitationScore,
        input.formFillMs,
        input.pageDwellMs,
        input.riskHint,
        JSON.stringify(input.rawPayload),
      ],
    );

    return result.rows[0];
  }
}
