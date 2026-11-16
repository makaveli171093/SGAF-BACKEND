import { OperationsModule } from '../operations/operations.module.js';
import { Module } from '@nestjs/common';
import { ScheduleBlocksController } from './schedule-blocks.controller.js';
import { ScheduleBlocksService } from './schedule-blocks.service.js';

@Module({
  imports: [OperationsModule],
  controllers: [ScheduleBlocksController],
  providers: [ScheduleBlocksService],
})
export class ScheduleBlocksModule {}
