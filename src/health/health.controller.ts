import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

type HealthStatus = {
  status: 'live' | 'ready';
};

@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('live')
  live(): HealthStatus {
    return { status: 'live' };
  }

  @Get('ready')
  async ready(): Promise<HealthStatus> {
    try {
      await this.prisma.probe();
      return { status: 'ready' };
    } catch {
      throw new ServiceUnavailableException('Database readiness probe failed');
    }
  }
}
