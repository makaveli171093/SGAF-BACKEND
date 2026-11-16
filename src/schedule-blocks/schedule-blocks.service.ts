import { Injectable } from '@nestjs/common';
import { OperationsService } from '../operations/operations.service.js';
import { CreateScheduleBlockDto } from './dto/create-schedule-block.dto.js';
@Injectable()
export class ScheduleBlocksService {
  constructor(private readonly operations: OperationsService) {}
  create(dto: CreateScheduleBlockDto, actorId: string) {
    return this.operations.schedule(null, dto, actorId);
  }
}
