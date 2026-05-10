import { Body, Controller, Post } from '@nestjs/common';
import { DevicesService } from './devices.service';
import { RefreshDeviceDto } from './dto/refresh-device.dto';
import { RegisterDeviceDto } from './dto/register-device.dto';

@Controller('v1/devices')
export class DevicesController {
  constructor(private readonly devicesService: DevicesService) {}

  @Post('register')
  register(@Body() dto: RegisterDeviceDto) {
    return this.devicesService.register(dto);
  }

  @Post('refresh')
  refresh(@Body() dto: RefreshDeviceDto) {
    return this.devicesService.refresh(dto);
  }
}
