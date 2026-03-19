import { Module } from '@nestjs/common';
import { AwsCostService } from './aws-cost.service';
import { AwsDailyCostService } from './aws-daily-cost.service';
import { AwsDailyCostScheduler } from './aws-daily-cost.scheduler';
import { AwsCostController } from './aws-cost.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { CryptoModule } from '../crypto/crypto.module';
import { NotificationModule } from '../notification/notification.module';

@Module({
  imports: [PrismaModule, CryptoModule, NotificationModule],
  controllers: [AwsCostController],
  providers: [AwsCostService, AwsDailyCostService, AwsDailyCostScheduler],
  exports: [AwsCostService],
})
export class AwsCostModule {}
