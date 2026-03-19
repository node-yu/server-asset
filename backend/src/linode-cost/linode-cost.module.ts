import { Module } from '@nestjs/common';
import { LinodeCostService } from './linode-cost.service';
import { LinodeDailyCostService } from './linode-daily-cost.service';
import { LinodeDailyCostScheduler } from './linode-daily-cost.scheduler';
import { LinodeCostController } from './linode-cost.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { CryptoModule } from '../crypto/crypto.module';

@Module({
  imports: [PrismaModule, CryptoModule],
  controllers: [LinodeCostController],
  providers: [LinodeCostService, LinodeDailyCostService, LinodeDailyCostScheduler],
  exports: [LinodeCostService],
})
export class LinodeCostModule {}
