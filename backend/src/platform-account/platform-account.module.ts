import { Module } from '@nestjs/common';
import { PlatformAccountService } from './platform-account.service';
import { PlatformAccountController } from './platform-account.controller';

@Module({
  controllers: [PlatformAccountController],
  providers: [PlatformAccountService],
})
export class PlatformAccountModule {}
