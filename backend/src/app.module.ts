import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { APP_GUARD } from '@nestjs/core';
import { PrismaModule } from './prisma/prisma.module';
import { CryptoModule } from './crypto/crypto.module';
import { AuthModule } from './auth/auth.module';
import { JwtAuthGuard } from './auth/jwt-auth.guard';
import { ServerModule } from './server/server.module';
import { StatsModule } from './stats/stats.module';
import { GroupModule } from './group/group.module';
import { ProjectModule } from './project/project.module';
import { PlatformModule } from './platform/platform.module';
import { PlatformAccountModule } from './platform-account/platform-account.module';
import { IdcModule } from './idc/idc.module';
import { AwsCostModule } from './aws-cost/aws-cost.module';
import { DoCostModule } from './do-cost/do-cost.module';
import { LinodeCostModule } from './linode-cost/linode-cost.module';
import { DomainModule } from './domain/domain.module';
import { NotificationModule } from './notification/notification.module';
import { ReminderModule } from './reminder/reminder.module';

@Module({
  imports: [ScheduleModule.forRoot(), PrismaModule, CryptoModule, AuthModule, ServerModule, StatsModule, GroupModule, ProjectModule, PlatformModule, PlatformAccountModule, IdcModule, AwsCostModule, DoCostModule, LinodeCostModule, DomainModule, NotificationModule, ReminderModule],
  providers: [{ provide: APP_GUARD, useClass: JwtAuthGuard }],
})
export class AppModule {}
