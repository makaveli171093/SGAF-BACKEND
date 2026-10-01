import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

export class GradeSubmissionDto {
  @ApiProperty({
    example: 85,
    minimum: 1,
    maximum: 100,
  })
  @IsNumber()
  @Min(1)
  @Max(100)
  grade: number;

  @ApiPropertyOptional({
    example: 'Buen desarrollo. Revisar el ejercicio 4.',
  })
  @IsOptional()
  @IsString()
  feedback?: string;
}
