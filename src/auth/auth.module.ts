import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { DatabaseModule } from '../database/database.module';
import { LoginThrottleService } from '../security/throttling.config';
import { AuthController } from './auth.controller';
import { AuthService, SessionAuthGuard } from './auth.service';
import { SessionService } from './session.service';

@Module({
  imports: [DatabaseModule, AuditModule],
  controllers: [AuthController],
  providers: [AuthService, SessionService, SessionAuthGuard, LoginThrottleService],
  exports: [AuthService, SessionService, SessionAuthGuard]
})
export class AuthModule {}
