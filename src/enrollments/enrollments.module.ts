import { Module } from '@nestjs/common';
import { EnrollmentsController } from './enrollments.controller.js';
import { EnrollmentsService } from './enrollments.service.js';
import { PaymentsModule } from '../payments/payments.module.js';

@Module({
  controllers: [EnrollmentsController],
  providers: [EnrollmentsService],
  imports: [PaymentsModule],
})
export class EnrollmentsModule {}
