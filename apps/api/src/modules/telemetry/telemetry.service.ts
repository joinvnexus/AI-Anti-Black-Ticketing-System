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
    const extractedSignals = this.extractSignals(dto);
    const riskHint = this.calculateRiskHint(dto, extractedSignals);

    if (!this.telemetryRepository.enabled) {
      const id = `${dto.deviceId}:${Date.now()}`;
      this.memorySnapshots.set(id, { ...dto, riskHint, extractedSignals });
      return {
        snapshotId: id,
        riskHint,
        extractedSignals,
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
        extractedSignals,
      },
    });

    return {
      snapshotId: snapshot.id,
      createdAt: snapshot.created_at.toISOString(),
      riskHint,
      extractedSignals,
    };
  }

  async findSnapshot(snapshotId?: string | null) {
    if (!snapshotId) {
      return null;
    }

    if (!this.telemetryRepository.enabled) {
      const snapshot = this.memorySnapshots.get(snapshotId);
      return snapshot ?? null;
    }

    return this.telemetryRepository.findById(snapshotId);
  }

  private calculateRiskHint(dto: SubmitTelemetryDto, extractedSignals: string[]) {
    return Math.min(
      100,
      Math.round(
        dto.hesitationScore * 0.35 +
          Math.min(dto.pasteCount * 10, 30) +
          Math.min(dto.focusSwitchCount * 5, 25) +
          (dto.typingSpeedCpm > 450 ? 20 : 0) +
          extractedSignals.length * 4,
      ),
    );
  }

  private extractSignals(dto: SubmitTelemetryDto) {
    const signals: string[] = [];

    if (dto.typingSpeedCpm >= 450) {
      signals.push('typing_speed_spike');
    }

    if (dto.pasteCount >= 2) {
      signals.push('paste_burst');
    }

    if (dto.focusSwitchCount >= 4) {
      signals.push('focus_switch_burst');
    }

    if (dto.pageDwellMs <= 3000 && dto.formFillMs <= 2500) {
      signals.push('low_dwell_fast_submit');
    }

    if (dto.mouseMovements <= Math.max(1, dto.clickCount)) {
      signals.push('low_pointer_entropy');
    }

    return signals;
  }
}
