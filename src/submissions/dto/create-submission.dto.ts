import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateSubmissionDto {
  @ApiProperty({
    example: 'uuid-de-la-tarea',
  })
  @IsUUID()
  assignmentId: string;

  @ApiPropertyOptional({
    example: 'Adjunto la resolución de los ejercicios solicitados.',
  })
  @IsOptional()
  @IsString()
  textContent?: string;

  @ApiPropertyOptional({
    example: 'https://storage.example.com/tarea1.pdf',
  })
  @IsOptional()
  @IsString()
  fileUrl?: string;
}
