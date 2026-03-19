import { Module } from '@nestjs/common';
import { DoCostService } from './do-cost.service';
import { DoDailyCostService } from './do-daily-cost.service';
import { DoDailyCostScheduler } from './do-daily-cost.scheduler';
import { DoCostController } from './do-cost.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { CryptoModule } from '../crypto/crypto.module';

@Module({
  imports: [PrismaModule, CryptoModule],
  controllers: [DoCostController],
  providers: [DoCostService, DoDailyCostService, DoDailyCostScheduler],
  exports: [DoCostService],
})
export class DoCostModule {}
