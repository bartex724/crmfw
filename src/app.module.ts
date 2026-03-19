import { MiddlewareConsumer, Module, NestModule, RequestMethod } from '@nestjs/common';
import { AccessModule } from './access/access.module';
import { AuditModule } from './audit/audit.module';
import { AuthModule } from './auth/auth.module';
import { BoxesModule } from './boxes/boxes.module';
import { AppConfigModule } from './config/config.module';
import { RequestLoggingMiddleware } from './common/logging/request-logging.middleware';
import { DatabaseModule } from './database/database.module';
import { EventsModule } from './events/events.module';
import { HealthModule } from './health/health.module';
import { InventoryModule } from './inventory/inventory.module';
import { MediaModule } from './media/media.module';
import { StorageModule } from './storage/storage.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    AppConfigModule,
    DatabaseModule,
    HealthModule,
    AccessModule,
    StorageModule,
    AuditModule,
    AuthModule,
    UsersModule,
    InventoryModule,
    EventsModule,
    BoxesModule,
    MediaModule
  ]
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply(RequestLoggingMiddleware)
      .forRoutes({
        path: '*',
        method: RequestMethod.ALL
      });
  }
}
