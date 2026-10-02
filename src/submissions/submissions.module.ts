import { Module } from '@nestjs/common';
import { SubmissionsController } from './submissions.controller.js';
import { SubmissionsService } from './submissions.service.js';
import { PaymentsModule } from '../payments/payments.module.js';

@Module({
  controllers: [SubmissionsController],
  providers: [SubmissionsService],
  imports: [PaymentsModule],
})
export class SubmissionsModule {}
