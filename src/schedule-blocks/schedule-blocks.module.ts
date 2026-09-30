import { Module } from '@nestjs/common';
import { ScheduleBlocksController } from './schedule-blocks.controller.js';
import { ScheduleBlocksService } from './schedule-blocks.service.js';

@Module({
  controllers: [ScheduleBlocksController],
  providers: [ScheduleBlocksService]
})
export class ScheduleBlocksModule {}
