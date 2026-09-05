import {
  BadGatewayException,
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Printer } from '../entities/printer.entity';
import { Outlet } from '../../outlet/outlet.entity';
import { Order } from '../../order/entities/order.entity';
import { Payment } from '../../payment/entities/payment.entity';
import { AuditService } from '../../audit/audit.service';
import { SettingsService } from '../../settings/services/settings.service';
import { EscPosBuilderService, EscPosResult } from './escpos-builder.service';
import { NetworkPrinterDriver } from './network-printer.driver';
import {
  CreatePrinterDto,
  PrintOrderDto,
  QueryPrinterDto,
  UpdatePrinterDto,
} from '../dto/printer.dto';

@Injectable()
export class PrinterService {
  constructor(
    @InjectRepository(Printer)
    private readonly printerRepository: Repository<Printer>,
    @InjectRepository(Outlet)
    private readonly outletRepository: Repository<Outlet>,
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    @InjectRepository(Payment)
    private readonly paymentRepository: Repository<Payment>,
    private readonly dataSource: DataSource,
    private readonly audit: AuditService,
    private readonly escposBuilder: EscPosBuilderService,
    private readonly networkPrinterDriver: NetworkPrinterDriver,
    private readonly settingsService: SettingsService,
  ) {}

  async findAll(tenantId: string, query: QueryPrinterDto) {
    const qb = this.printerRepository
      .createQueryBuilder('printer')
      .leftJoinAndSelect('printer.outlet', 'outlet')
      .where('printer.tenantId = :tenantId', { tenantId });

    if (query.outletId) {
      qb.andWhere('printer.outletId = :outletId', { outletId: query.outletId });
    }

    if (query.type) {
      qb.andWhere('printer.type = :type', { type: query.type });
    }

    if (query.connectionType) {
      qb.andWhere('printer.connectionType = :connectionType', {
        connectionType: query.connectionType,
      });
    }

    if (query.status) {
      qb.andWhere('printer.status = :status', { status: query.status });
    }

    qb.orderBy('printer.createdAt', 'DESC');
    return qb.getMany();
  }

  async findById(tenantId: string, id: string): Promise<Printer> {
    const printer = await this.printerRepository.findOne({
      where: { id, tenantId },
      relations: ['outlet'],
    });

    if (!printer) {
      throw new NotFoundException({
        success: false,
        message: 'Printer not found',
        code: 'PRINTER_NOT_FOUND',
      });
    }

    return printer;
  }

  async create(
    tenantId: string,
    dto: CreatePrinterDto,
    userId: string,
  ): Promise<Printer> {
    const outlet = await this.outletRepository.findOne({
      where: { id: dto.outletId, tenantId },
    });

    if (!outlet) {
      throw new NotFoundException({
        success: false,
        message: 'Outlet not found',
        code: 'OUTLET_NOT_FOUND',
      });
    }

    if (dto.connectionType === 'NETWORK' && !dto.ipAddress) {
      throw new BadRequestException({
        success: false,
        message: 'IP address is required for NETWORK printer connection',
        code: 'IP_ADDRESS_REQUIRED',
      });
    }

    return this.dataSource.transaction(async (manager) => {
      const printerRepo = manager.getRepository(Printer);

      if (dto.isDefault) {
        await printerRepo.update(
          {
            tenantId,
            outletId: dto.outletId,
            type: dto.type,
            isDefault: true,
          },
          { isDefault: false },
        );
      }

      const printer = printerRepo.create({
        tenantId,
        outletId: dto.outletId,
        name: dto.name,
        type: dto.type,
        connectionType: dto.connectionType,
        paperSize: dto.paperSize ?? '58mm',
        ipAddress: dto.ipAddress ?? null,
        port: dto.port ?? 9100,
        bluetoothMac: dto.bluetoothMac ?? null,
        isDefault: dto.isDefault ?? false,
        status: 'ACTIVE',
      });

      const saved = await printerRepo.save(printer);

      await this.audit.record({
        action: 'PRINTER_CREATED',
        tenantId,
        actorType: 'USER',
        actorId: userId,
        metadata: {
          printerId: saved.id,
          name: saved.name,
          type: saved.type,
          connectionType: saved.connectionType,
          outletId: saved.outletId,
          isDefault: saved.isDefault,
        },
      });

      return saved;
    });
  }

  async update(
    tenantId: string,
    id: string,
    dto: UpdatePrinterDto,
    userId: string,
  ): Promise<Printer> {
    const existing = await this.findById(tenantId, id);

    const targetConnectionType = dto.connectionType ?? existing.connectionType;
    const targetIpAddress = dto.ipAddress ?? existing.ipAddress;
    const targetType = dto.type ?? existing.type;

    if (targetConnectionType === 'NETWORK' && !targetIpAddress) {
      throw new BadRequestException({
        success: false,
        message: 'IP address is required for NETWORK printer connection',
        code: 'IP_ADDRESS_REQUIRED',
      });
    }

    return this.dataSource.transaction(async (manager) => {
      const printerRepo = manager.getRepository(Printer);

      if (dto.isDefault === true) {
        await printerRepo.update(
          {
            tenantId,
            outletId: existing.outletId,
            type: targetType,
            isDefault: true,
          },
          { isDefault: false },
        );
      }

      const updateData: {
        name?: string;
        type?: typeof targetType;
        connectionType?: typeof targetConnectionType;
        paperSize?: '58mm' | '80mm';
        ipAddress?: string | null;
        port?: number | null;
        bluetoothMac?: string | null;
        isDefault?: boolean;
        status?: 'ACTIVE' | 'INACTIVE';
      } = {};
      if (dto.name !== undefined) updateData.name = dto.name;
      if (dto.type !== undefined) updateData.type = dto.type;
      if (dto.connectionType !== undefined)
        updateData.connectionType = dto.connectionType;
      if (dto.paperSize !== undefined) updateData.paperSize = dto.paperSize;
      if (dto.ipAddress !== undefined) updateData.ipAddress = dto.ipAddress;
      if (dto.port !== undefined) updateData.port = dto.port;
      if (dto.bluetoothMac !== undefined)
        updateData.bluetoothMac = dto.bluetoothMac;
      if (dto.isDefault !== undefined) updateData.isDefault = dto.isDefault;
      if (dto.status !== undefined) updateData.status = dto.status;

      await printerRepo.update({ id, tenantId }, updateData);

      const updated = await printerRepo.findOneOrFail({
        where: { id, tenantId },
        relations: ['outlet'],
      });

      await this.audit.record({
        action: 'PRINTER_UPDATED',
        tenantId,
        actorType: 'USER',
        actorId: userId,
        metadata: {
          printerId: updated.id,
          name: updated.name,
          type: updated.type,
          connectionType: updated.connectionType,
          isDefault: updated.isDefault,
        },
      });

      return updated;
    });
  }

  async delete(
    tenantId: string,
    id: string,
    userId: string,
  ): Promise<{ success: boolean }> {
    const existing = await this.findById(tenantId, id);

    await this.printerRepository.delete({ id, tenantId });

    await this.audit.record({
      action: 'PRINTER_DELETED',
      tenantId,
      actorType: 'USER',
      actorId: userId,
      metadata: {
        printerId: existing.id,
        name: existing.name,
        type: existing.type,
        outletId: existing.outletId,
      },
    });

    return { success: true };
  }

  async printOrder(
    tenantId: string,
    orderId: string,
    dto: PrintOrderDto,
    userId: string,
    cashierName?: string,
  ) {
    const order = await this.orderRepository.findOne({
      where: { id: orderId, tenantId },
      relations: ['items', 'tenant', 'outlet', 'table'],
    });

    if (!order) {
      throw new NotFoundException({
        success: false,
        message: 'Order not found',
        code: 'ORDER_NOT_FOUND',
      });
    }

    const targetType = dto.type ?? 'RECEIPT';

    if (targetType === 'RECEIPT' && order.status !== 'COMPLETED') {
      throw new BadRequestException({
        success: false,
        message: 'Bill can only be printed for COMPLETED orders',
        code: 'ORDER_NOT_COMPLETED',
      });
    }

    let printer: Printer | null = null;
    if (dto.printerId) {
      printer = await this.printerRepository.findOne({
        where: {
          id: dto.printerId,
          tenantId,
          outletId: order.outletId,
        },
      });
      if (!printer) {
        throw new NotFoundException({
          success: false,
          message: 'Specified printer not found for this outlet',
          code: 'PRINTER_NOT_FOUND',
        });
      }
    } else {
      printer = await this.printerRepository.findOne({
        where: {
          tenantId,
          outletId: order.outletId,
          type: targetType,
          isDefault: true,
          status: 'ACTIVE',
        },
      });

      if (!printer) {
        printer = await this.printerRepository.findOne({
          where: {
            tenantId,
            outletId: order.outletId,
            type: targetType,
            status: 'ACTIVE',
          },
        });
      }
    }

    if (!printer) {
      throw new NotFoundException({
        success: false,
        message: `No active ${targetType} printer configured for this outlet`,
        code: 'DEFAULT_PRINTER_NOT_FOUND',
      });
    }

    let result: EscPosResult;
    if (targetType === 'RECEIPT') {
      const payments = await this.paymentRepository.find({
        where: { orderId: order.id, tenantId },
      });
      const settings = await this.settingsService.getSettings(
        tenantId,
        order.outletId,
      );
      result = this.escposBuilder.buildReceipt({
        order,
        payments,
        cashierName: cashierName ?? 'Kasir',
        paperSize: printer.paperSize,
        footerNote: settings.billFooterText || undefined,
        taxName: settings.taxName || undefined,
      });
    } else if (targetType === 'KITCHEN') {
      result = this.escposBuilder.buildKitchenTicket({
        order,
        paperSize: printer.paperSize,
      });
    } else {
      result = this.escposBuilder.buildBarTicket({
        order,
        paperSize: printer.paperSize,
      });
    }

    let status = 'READY_TO_PRINT';

    if (printer.connectionType === 'NETWORK') {
      if (!printer.ipAddress) {
        throw new BadGatewayException({
          success: false,
          message: 'Printer IP address not configured',
          code: 'PRINTER_UNREACHABLE',
        });
      }

      try {
        await this.networkPrinterDriver.send({
          ipAddress: printer.ipAddress,
          port: printer.port ?? 9100,
          data: result.buffer,
        });
        status = 'SENT';
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : 'Connection failed';
        throw new BadGatewayException({
          success: false,
          message: `Printer communication failed: ${errMsg}`,
          code: 'PRINTER_UNREACHABLE',
        });
      }
    }

    await this.audit.record({
      action: 'ORDER_PRINTED',
      tenantId,
      actorType: 'USER',
      actorId: userId,
      metadata: {
        orderId: order.id,
        orderNumber: order.orderNumber,
        printerId: printer.id,
        printerName: printer.name,
        type: targetType,
        connectionType: printer.connectionType,
        status,
      },
    });

    return {
      orderId: order.id,
      orderNumber: order.orderNumber,
      printerId: printer.id,
      printerName: printer.name,
      type: targetType,
      connectionType: printer.connectionType,
      paperSize: printer.paperSize,
      status,
      escposPayload: result.base64,
      rawText: result.rawText,
    };
  }
}
