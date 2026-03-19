import { Global, Module } from '@nestjs/common';
import { buildConfiguration, type AppConfig } from './configuration';

export const APP_CONFIG = Symbol('APP_CONFIG');

@Global()
@Module({
  providers: [
    {
      provide: APP_CONFIG,
      useFactory: (): AppConfig => buildConfiguration(process.env)
    }
  ],
  exports: [APP_CONFIG]
})
export class AppConfigModule {}
