import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

const RETENTION_DAYS = 90;
const DAY_IN_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class AuditRetentionService {
  constructor(private readonly prisma: PrismaService) {}

  async cleanup(now: Date = new Date()): Promise<number> {
    const cutoff = new Date(now.getTime() - RETENTION_DAYS * DAY_IN_MS);
    const deleted = await this.prisma.auditLog.deleteMany({
      where: {
        createdAt: {
          lt: cutoff
        }
      }
    });

    return deleted.count;
  }
}
