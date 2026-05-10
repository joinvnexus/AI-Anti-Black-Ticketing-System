import { Body, Controller, Headers, Post } from '@nestjs/common';
import { PaymentCallbackDto } from './dto/payment-callback.dto';
import { PreauthorizePaymentDto } from './dto/preauthorize-payment.dto';
import { PaymentsService } from './payments.service';

@Controller('v1/payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post('preauthorize')
  preauthorize(
    @Body() dto: PreauthorizePaymentDto,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.paymentsService.preauthorize(
      dto,
      idempotencyKey ?? `${dto.holdReference}:${dto.amount}:${dto.provider}`,
    );
  }

  @Post('callback')
  callback(
    @Body() dto: PaymentCallbackDto,
    @Headers('x-payment-signature') signature?: string,
  ) {
    const rawPayload = JSON.stringify(dto);
    return this.paymentsService.callback(dto, signature ?? '', rawPayload);
  }
}
