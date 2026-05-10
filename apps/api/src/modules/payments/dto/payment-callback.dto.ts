import { IsIn, IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class PaymentCallbackDto {
  @IsString()
  @IsNotEmpty()
  paymentReference!: string;

  @IsString()
  @IsIn(['authorized', 'failed', 'refunded', 'chargeback'])
  status!: 'authorized' | 'failed' | 'refunded' | 'chargeback';

  @IsOptional()
  @IsNumber()
  @Min(0)
  amount?: number;

  @IsOptional()
  @IsString()
  providerReference?: string;

  @IsOptional()
  @IsString()
  gatewayReference?: string;
}
