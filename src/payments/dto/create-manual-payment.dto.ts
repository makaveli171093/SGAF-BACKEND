import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsUUID } from 'class-validator';
import { PaymentMethod } from '../../generated/prisma/enums.js';

export class CreateManualPaymentDto {
  @ApiProperty({
    description: 'UUID de la obligación financiera que será pagada',
    example: '9b44132e-c224-442b-b0ea-38c35ca4f0c6',
  })
  @IsUUID()
  obligationId: string;

  @ApiProperty({
    enum: [PaymentMethod.CASH, PaymentMethod.BANK_TRANSFER],
    example: PaymentMethod.CASH,
    description: 'Método de pago manual',
  })
  @IsIn([PaymentMethod.CASH, PaymentMethod.BANK_TRANSFER])
  method: PaymentMethod;
}
