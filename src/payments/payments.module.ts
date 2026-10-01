import { Module } from '@nestjs/common';
import { PaymentsController } from './payments.controller.js';
import { PaymentsService } from './payments.service.js';
import { MockPayService } from './mockpay.service.js';

@Module({
  controllers: [PaymentsController],
  providers: [PaymentsService, MockPayService],
})
export class PaymentsModule {}
