import { BadGatewayException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

interface CreateMockPayPaymentInput {
  amount: number;
  currency: string;
  metadata: Record<string, string>;
  webhook_url?: string;
}

interface MockPayApiResponse {
  id_transaccion: string;
  checkout_url: string;
  [key: string]: unknown;
}

interface MockPayPaymentResponse {
  id: string;
  checkout_url: string;
}

@Injectable()
export class MockPayService {
  constructor(private readonly configService: ConfigService) {}
  async createPayment(
    input: CreateMockPayPaymentInput,
  ): Promise<MockPayPaymentResponse> {
    const baseUrl = this.configService
      .getOrThrow<string>('MOCKPAY_API_URL')
      .replace(/\/+$/, '');
    const secretKey =
      this.configService.getOrThrow<string>('MOCKPAY_SECRET_KEY');

    const response = await fetch(`${baseUrl}/api/v1/payments`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${secretKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(input),
    });

    const responseText = await response.text();

    if (!response.ok) {
      throw new BadGatewayException('No se pudo comunicar con MockPay');
    }

    const data = JSON.parse(responseText) as MockPayApiResponse;

    if (!data.id_transaccion || !data.checkout_url) {
      throw new BadGatewayException(
        'La respuesta de MockPay no contiene id_transaccion o checkout_url',
      );
    }

    return {
      id: data.id_transaccion,
      checkout_url: data.checkout_url,
    };
  }
}
