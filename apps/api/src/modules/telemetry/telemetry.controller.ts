import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { SubmitTelemetryDto } from './dto/submit-telemetry.dto';
import { TelemetryService } from './telemetry.service';

@Controller('v1/telemetry')
export class TelemetryController {
  constructor(private readonly telemetryService: TelemetryService) {}

  @Post('snapshots')
  submit(@Body() dto: SubmitTelemetryDto) {
    return this.telemetryService.submit(dto);
  }

  @Get('snapshots/:snapshotId/features')
  features(@Param('snapshotId') snapshotId: string) {
    return this.telemetryService.getFeatureVector(snapshotId);
  }
}
