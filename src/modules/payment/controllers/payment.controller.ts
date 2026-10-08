import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { PaymentService } from '../services/payment.service';
import {
  CreatePaymentDto,
  GenerateQrisDto,
  QueryPaymentDto,
  QueryTransactionDto,
} from '../dto/payment.dto';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { Permissions } from '../../../common/decorators/permissions.decorator';
import { User } from '../../user/user.entity';
import {
  isTenantWideUser,
  resolveEffectiveOutletId,
} from '../../../common/utils/outlet-scoping.util';

@Controller()
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  @Get('payments')
  @Permissions('payment.read')
  async findPayments(
    @CurrentUser() user: User,
    @Query() query: QueryPaymentDto,
  ) {
    const effectiveOutletId = resolveEffectiveOutletId(user, query.outletId);
    const result = await this.paymentService.findPayments(user.tenantId, {
      ...query,
      outletId: effectiveOutletId,
    });
    return {
      success: true,
      message: 'Payments retrieved successfully',
      ...result,
    };
  }

  @Post('payments')
  @Permissions('payment.create')
  async createPayment(
    @CurrentUser() user: User,
    @Body() dto: CreatePaymentDto,
  ) {
    const data = await this.paymentService.create(user.tenantId, user.id, dto);
    return {
      success: true,
      message: 'Payment processed and transaction completed successfully',
      data,
    };
  }

  @Post('payments/qris/generate')
  @Permissions('payment.create')
  async generateQris(@CurrentUser() user: User, @Body() dto: GenerateQrisDto) {
    const data = await this.paymentService.generateQris(
      user.tenantId,
      user.id,
      dto,
    );
    return {
      success: true,
      message: 'Dynamic QRIS generated successfully',
      data,
    };
  }

  @Get('payments/qris/status/:orderId')
  @Permissions('payment.read')
  async getQrisStatus(
    @CurrentUser() user: User,
    @Param('orderId', ParseUUIDPipe) orderId: string,
  ) {
    const data = await this.paymentService.getQrisStatus(
      user.tenantId,
      orderId,
    );
    return {
      success: true,
      message: 'QRIS status retrieved successfully',
      data,
    };
  }

  @Post('payments/qris/check/:orderId')
  @Permissions('payment.create')
  async checkQrisStatus(
    @CurrentUser() user: User,
    @Param('orderId', ParseUUIDPipe) orderId: string,
  ) {
    const data = await this.paymentService.checkQrisStatus(
      user.tenantId,
      user.id,
      orderId,
    );
    return {
      success: true,
      message: 'QRIS status checked successfully',
      data,
    };
  }

  @Post('payments/qris/simulate-pay/:paymentId')
  @Permissions('payment.create')
  async simulateQrisPayment(
    @CurrentUser() user: User,
    @Param('paymentId', ParseUUIDPipe) paymentId: string,
  ) {
    const data = await this.paymentService.simulateQrisPayment(
      user.tenantId,
      user.id,
      paymentId,
    );
    return {
      success: true,
      message: 'Simulated QRIS payment settled successfully',
      data,
    };
  }

  @Get('transactions')
  @Permissions('transaction.read')
  async findTransactions(
    @CurrentUser() user: User,
    @Query() query: QueryTransactionDto,
  ) {
    const effectiveOutletId = resolveEffectiveOutletId(user, query.outletId);
    const result = await this.paymentService.findTransactions(user.tenantId, {
      ...query,
      outletId: effectiveOutletId,
    });
    return {
      success: true,
      message: 'Transactions retrieved successfully',
      ...result,
    };
  }

  @Get('transactions/:id')
  @Permissions('transaction.read')
  async findTransactionById(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const data = await this.paymentService.findTransactionById(
      user.tenantId,
      id,
    );
    if (!isTenantWideUser(user)) {
      const permitted = new Set<string>();
      if (user.outletId) permitted.add(user.outletId);
      if (user.assignedOutlets) {
        user.assignedOutlets.forEach((o) => permitted.add(o.id));
      }
      if (data.outletId && !permitted.has(data.outletId)) {
        throw new NotFoundException({
          success: false,
          message: 'Transaction not found',
          code: 'TRANSACTION_NOT_FOUND',
        });
      }
    }
    return {
      success: true,
      message: 'Transaction details retrieved successfully',
      data,
    };
  }
}
