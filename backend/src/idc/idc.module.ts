import { Module } from '@nestjs/common';
import { IdcService } from './idc.service';
import { IdcController } from './idc.controller';

@Module({
  controllers: [IdcController],
  providers: [IdcService],
})
export class IdcModule {}
