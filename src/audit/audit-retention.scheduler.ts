import { Injectable } from '@nestjs/common';
import { AuditRetentionService } from './audit-retention.service';

@Injectable()
export class AuditRetentionScheduler {
  constructor(private readonly retentionService: AuditRetentionService) {}

  async cleanupDaily(now: Date = new Date()): Promise<number> {
    return this.retentionService.cleanup(now);
  }
}
