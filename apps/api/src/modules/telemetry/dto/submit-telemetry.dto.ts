import { IsInt, IsNotEmpty, IsOptional, IsString, Max, Min } from 'class-validator';

export class SubmitTelemetryDto {
  @IsOptional()
  @IsString()
  userId?: string;

  @IsOptional()
  @IsString()
  sessionId?: string;

  @IsOptional()
  @IsString()
  riskAssessmentId?: string;

  @IsString()
  @IsNotEmpty()
  deviceId!: string;

  @IsOptional()
  @IsString()
  journeyId?: string;

  @IsInt()
  @Min(0)
  mouseMovements!: number;

  @IsInt()
  @Min(0)
  clickCount!: number;

  @IsInt()
  @Min(0)
  typingSpeedCpm!: number;

  @IsInt()
  @Min(0)
  focusSwitchCount!: number;

  @IsInt()
  @Min(0)
  pasteCount!: number;

  @IsInt()
  @Min(0)
  @Max(100)
  hesitationScore!: number;

  @IsInt()
  @Min(0)
  formFillMs!: number;

  @IsInt()
  @Min(0)
  pageDwellMs!: number;
}
