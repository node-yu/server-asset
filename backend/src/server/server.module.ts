import { Module } from '@nestjs/common';
import { ServerService } from './server.service';
import { ServerController } from './server.controller';
import { PlatformModule } from '../platform/platform.module';

@Module({
  imports: [PlatformModule],
  controllers: [ServerController],
  providers: [ServerService],
})
export class ServerModule {}
