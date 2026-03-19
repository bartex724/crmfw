import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { AuditRetentionScheduler } from './audit-retention.scheduler';
import { AuditRetentionService } from './audit-retention.service';
import { AuditService } from './audit.service';

@Module({
  imports: [DatabaseModule],
  providers: [AuditService, AuditRetentionService, AuditRetentionScheduler],
  exports: [AuditService, AuditRetentionService, AuditRetentionScheduler]
})
export class AuditModule {}
