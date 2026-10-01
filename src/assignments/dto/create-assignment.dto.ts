import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsNotEmpty, IsString, IsUUID } from 'class-validator';

export class CreateAssignmentDto {
  @ApiProperty({
    example: 'uuid-del-grupo',
  })
  @IsUUID()
  groupId: string;

  @ApiProperty({
    example: 'Trabajo práctico 1',
  })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({
    example: 'Resolver los ejercicios 1 al 10 y justificar el procedimiento.',
  })
  @IsString()
  @IsNotEmpty()
  instructions: string;

  @ApiProperty({
    example: '2026-10-05T23:59:00.000Z',
  })
  @IsDateString()
  dueDate: string;
}
