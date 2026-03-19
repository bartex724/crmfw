import { Module } from '@nestjs/common';
import { AccessModule } from '../access/access.module';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { DatabaseModule } from '../database/database.module';
import { EventExportsService } from './event-exports.service';
import { EventsController } from './events.controller';
import { EventsService } from './events.service';

@Module({
  imports: [AccessModule, AuthModule, AuditModule, DatabaseModule],
  controllers: [EventsController],
  providers: [EventsService, EventExportsService],
  exports: [EventsService, EventExportsService]
})
export class EventsModule {}
