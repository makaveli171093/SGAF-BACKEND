import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsString, IsUUID, Min } from 'class-validator';

export class CreateGroupDto {
  @ApiProperty({
    example: 'Grupo A',
  })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({
    example: 30,
    minimum: 1,
  })
  @IsInt()
  @Min(1)
  maxCapacity: number;

  @ApiProperty({
    example: 'uuid de la materia',
  })
  @IsUUID()
  subjectId: string;

  @ApiProperty({
    example: 'uuid del periodo academico',
  })
  @IsUUID()
  academicPeriodId: string;

  @ApiProperty({
    example: 'uuid del perfil del profesor',
  })
  @IsUUID()
  teacherId: string;
}
