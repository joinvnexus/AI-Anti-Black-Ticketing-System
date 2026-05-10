import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { JoinQueueDto } from './dto/join-queue.dto';
import { QueueService } from './queue.service';

@Controller('v1/queue')
export class QueueController {
  constructor(private readonly queueService: QueueService) {}

  @Post('join')
  join(@Body() dto: JoinQueueDto) {
    return this.queueService.join(dto);
  }

  @Get('status/:token')
  status(@Param('token') token: string) {
    return this.queueService.status(token);
  }

  @Post('dequeue/:journeyId')
  dequeue(@Param('journeyId') journeyId: string) {
    return this.queueService.dequeue(journeyId);
  }

  @Post('cooldown')
  cooldown(
    @Body()
    body: {
      userId: string;
      journeyId: string;
      deviceId: string;
      reason: string;
      minutes?: number;
    },
  ) {
    return this.queueService.cooldown(
      body.userId,
      body.journeyId,
      body.deviceId,
      body.reason,
      body.minutes,
    );
  }
}
