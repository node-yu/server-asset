import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { ReminderService } from './reminder.service';
import { ReminderController } from './reminder.controller';

@Module({
  imports: [PrismaModule],
  controllers: [ReminderController],
  providers: [ReminderService],
  exports: [ReminderService],
})
export class ReminderModule {}
