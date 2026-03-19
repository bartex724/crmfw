import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    const connectionString = process.env.DATABASE_URL;
    if (connectionString) {
      const adapter = new PrismaPg({ connectionString });
      super({ adapter });
      return;
    }

    // Allow app bootstrap in environments where DATABASE_URL is injected later.
    super();
  }

  async onModuleInit(): Promise<void> {
    // In serverless environments, eager connect can fail cold-starts.
    // Prisma will connect lazily on first query.
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }

  async probe(): Promise<void> {
    await this.$queryRaw`SELECT 1`;
  }
}
