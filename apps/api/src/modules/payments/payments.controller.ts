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
      idempotencyKey ?? `${dto.queueToken}:${dto.amount}:${dto.provider}`,
    );
  }

  @Post('callback')
  callback(
    @Body() dto: PaymentCallbackDto,
    @Headers('x-payment-signature') signature?: string,
    @Headers('x-request-id') requestId?: string,
    @Headers('x-request-timestamp') requestTimestamp?: string,
  ) {
    const rawPayload = JSON.stringify(dto);
    return this.paymentsService.callback(dto, {
      signature: signature ?? '',
      rawPayload,
      requestId: requestId ?? `${dto.paymentReference}:${dto.status}`,
      requestTimestamp: requestTimestamp ?? '',
    });
  }
}
