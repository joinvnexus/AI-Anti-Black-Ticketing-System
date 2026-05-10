import { IsInt, IsNotEmpty, IsOptional, IsString, Max, Min } from 'class-validator';

export class JoinQueueDto {
  @IsString()
  @IsNotEmpty()
  userId!: string;

  @IsString()
  @IsNotEmpty()
  journeyId!: string;

  @IsString()
  @IsNotEmpty()
  deviceId!: string;

  @IsOptional()
  @IsString()
  sessionId?: string;

  @IsOptional()
  @IsString()
  telemetrySnapshotId?: string;

  @IsInt()
  @Min(0)
  @Max(100)
  deviceRisk!: number;

  @IsInt()
  @Min(0)
  @Max(100)
  behaviorRisk!: number;

  @IsInt()
  @Min(0)
  @Max(100)
  networkRisk!: number;

  @IsInt()
  @Min(0)
  @Max(100)
  accountRisk!: number;
}
