import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { BookingModule } from './booking/booking.module';
import { AuditModule } from './common/audit/audit.module';
import { EventsModule } from './common/events/events.module';
import { SecurityModule } from './common/security/security.module';
import { DatabaseModule } from './database/database.module';
import { DevicesModule } from './devices/devices.module';
import { FraudGraphModule } from './fraud-graph/fraud-graph.module';
import { HealthModule } from './health/health.module';
import { PaymentsModule } from './payments/payments.module';
import { QueueModule } from './queue/queue.module';
import { RiskModule } from './risk/risk.module';
import { TelemetryModule } from './telemetry/telemetry.module';
import { MonitoringModule } from './monitoring/monitoring.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    DatabaseModule,
    AuditModule,
    EventsModule,
    SecurityModule,
    FraudGraphModule,
    HealthModule,
    AuthModule,
    RiskModule,
    QueueModule,
    BookingModule,
    TelemetryModule,
    DevicesModule,
    PaymentsModule,
    MonitoringModule,
  ],
})
export class AppModule {}
