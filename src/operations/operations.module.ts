import { Module } from '@nestjs/common';
import { OperationsService } from './operations.service.js';
import {
  OperationsController,
  AccountController,
} from './operations.controller.js';
@Module({
  controllers: [OperationsController, AccountController],
  providers: [OperationsService],
  exports: [OperationsService],
})
export class OperationsModule {}
