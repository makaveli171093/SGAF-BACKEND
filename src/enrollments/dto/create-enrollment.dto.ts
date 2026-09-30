import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class CreateEnrollmentDto {
  @ApiProperty({
    description: 'ID del grupo al que desea matricularse',
    example: '550e...',
  })
  @IsUUID()
  groupId: string;
}
