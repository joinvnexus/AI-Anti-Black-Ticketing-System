import { IsInt, IsNotEmpty, IsString, Max, Min } from 'class-validator';

export class CreateHoldDto {
  @IsString()
  @IsNotEmpty()
  userId!: string;

  @IsString()
  @IsNotEmpty()
  journeyId!: string;

  @IsString()
  @IsNotEmpty()
  queueToken!: string;

  @IsInt()
  @Min(1)
  @Max(2)
  seatCount!: number;
}
