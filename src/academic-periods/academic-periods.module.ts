import { Module } from '@nestjs/common';
import { AcademicPeriodsController } from './academic-periods.controller.js';
import { AcademicPeriodsService } from './academic-periods.service.js';

@Module({
  controllers: [AcademicPeriodsController],
  providers: [AcademicPeriodsService],
})
export class AcademicPeriodsModule {}
