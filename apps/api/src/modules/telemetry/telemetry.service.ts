import { Injectable } from '@nestjs/common';
import { AuditService } from '../common/audit/audit.service';
import { SubmitTelemetryDto } from './dto/submit-telemetry.dto';
import { TelemetryRepository } from './telemetry.repository';

@Injectable()
export class TelemetryService {
  private readonly memorySnapshots = new Map<string, Record<string, unknown>>();

  constructor(
    private readonly telemetryRepository: TelemetryRepository,
    private readonly auditService: AuditService,
  ) {}

  async submit(dto: SubmitTelemetryDto) {
    const riskHint = Math.min(
      100,
      Math.round(
        dto.hesitationScore * 0.35 +
          Math.min(dto.pasteCount * 10, 30) +
          Math.min(dto.focusSwitchCount * 5, 25) +
          (dto.typingSpeedCpm > 450 ? 20 : 0),
      ),
    );

    if (!this.telemetryRepository.enabled) {
      const id = `${dto.deviceId}:${Date.now()}`;
      this.memorySnapshots.set(id, { ...dto, riskHint });
      return {
        snapshotId: id,
        riskHint,
      };
    }

    const snapshot = await this.telemetryRepository.create({
      ...dto,
      riskHint,
      rawPayload: {
        userId: dto.userId ?? null,
        sessionId: dto.sessionId ?? null,
        deviceId: dto.deviceId,
        journeyId: dto.journeyId ?? null,
        mouseMovements: dto.mouseMovements,
        clickCount: dto.clickCount,
        typingSpeedCpm: dto.typingSpeedCpm,
        focusSwitchCount: dto.focusSwitchCount,
        pasteCount: dto.pasteCount,
        hesitationScore: dto.hesitationScore,
        formFillMs: dto.formFillMs,
        pageDwellMs: dto.pageDwellMs,
      },
    });

    await this.auditService.record({
      actorUserId: dto.userId,
      action: 'telemetry.submit',
      resourceType: 'telemetry_snapshot',
      resourceId: snapshot.id,
      outcome: 'success',
      metadata: {
        deviceId: dto.deviceId,
        riskHint,
      },
    });

    return {
      snapshotId: snapshot.id,
      createdAt: snapshot.created_at.toISOString(),
      riskHint,
    };
  }
}
