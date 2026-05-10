import { IsIn, IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class PreauthorizePaymentDto {
  @IsString()
  @IsNotEmpty()
  userId!: string;

  @IsString()
  @IsNotEmpty()
  queueToken!: string;

  @IsString()
  @IsNotEmpty()
  journeyId!: string;

  @IsString()
  @IsNotEmpty()
  deviceId!: string;

  @IsString()
  @IsNotEmpty()
  sessionId!: string;

  @IsNumber()
  @Min(1)
  seatCount!: number;

  @IsNumber()
  @Min(0)
  amount!: number;

  @IsString()
  @IsIn(['sslcommerz', 'bkash', 'nagad'])
  provider!: 'sslcommerz' | 'bkash' | 'nagad';

  @IsOptional()
  @IsString()
  paymentIdentity?: string;

  @IsOptional()
  @IsString()
  walletId?: string;

  @IsOptional()
  @IsString()
  phone?: string;
}
