import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';
import { AcademicPeriodStatus } from '../../generated/prisma/enums.js';

export class UpdateAcademicPeriodStatusDto {
  @ApiProperty({ enum: ['ACTIVE', 'CLOSED'] })
  @IsIn([AcademicPeriodStatus.ACTIVE, AcademicPeriodStatus.CLOSED])
  status: 'ACTIVE' | 'CLOSED';
}
