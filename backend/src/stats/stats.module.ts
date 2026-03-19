import { Module } from '@nestjs/common';
import { StatsService } from './stats.service';
import { StatsController } from './stats.controller';
import { AwsCostModule } from '../aws-cost/aws-cost.module';
import { DomainModule } from '../domain/domain.module';

@Module({
  imports: [AwsCostModule, DomainModule],
  controllers: [StatsController],
  providers: [StatsService],
})
export class StatsModule {}
