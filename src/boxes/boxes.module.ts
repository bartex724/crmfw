import { Module } from '@nestjs/common';
import { AccessModule } from '../access/access.module';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { DatabaseModule } from '../database/database.module';
import { BoxesController } from './boxes.controller';
import { BoxesService } from './boxes.service';

@Module({
  imports: [AccessModule, AuthModule, AuditModule, DatabaseModule],
  controllers: [BoxesController],
  providers: [BoxesService],
  exports: [BoxesService]
})
export class BoxesModule {}
