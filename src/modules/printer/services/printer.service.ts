import {
  BadGatewayException,
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { Printer } from '../entities/printer.entity';
import { PrinterCategoryRouting } from '../entities/printer-category-routing.entity';
import { Category } from '../../product/entities/category.entity';
import { Outlet } from '../../outlet/outlet.entity';
import { Order } from '../../order/entities/order.entity';
import { OrderItem } from '../../order/entities/order-item.entity';
import { Payment } from '../../payment/entities/payment.entity';
import { AuditService } from '../../audit/audit.service';
import { SettingsService } from '../../settings/services/settings.service';
import { EscPosBuilderService, EscPosResult } from './escpos-builder.service';
import { NetworkPrinterDriver } from './network-printer.driver';
import {
  CreatePrinterDto,
  DispatchOrderDto,
  PrintOrderDto,
  QueryPrinterDto,
  UpdatePrinterDto,
  UpdatePrinterRoutingDto,
} from '../dto/printer.dto';

export interface PrintJobResult {
  printerId: string;
  printerName: string;
  station: string;
  connectionType: string;
  paperSize: string;
  bluetoothMac: string | null;
  ipAddress: string | null;
  status: string;
  itemCount: number;
  escposPayload: string;
  rawText: string;
}

@Injectable()
export class PrinterService {
  constructor(
    @InjectRepository(Printer)
    private readonly printerRepository: Repository<Printer>,
    @InjectRepository(PrinterCategoryRouting)
    private readonly routingRepository: Repository<PrinterCategoryRouting>,
    @InjectRepository(Category)
    private readonly categoryRepository: Repository<Category>,
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

  async testPrint(tenantId: string, id: string, userId: string) {
    const printer = await this.findById(tenantId, id);

    const result = this.escposBuilder.buildTestSlip({
      outletName: printer.outlet?.name || 'AGILIX POS',
      printerName: printer.name,
      stationType: printer.type,
      connectionType: printer.connectionType,
      paperSize: printer.paperSize,
      ipAddress: printer.ipAddress
        ? `${printer.ipAddress}:${printer.port || 9100}`
        : null,
      bluetoothMac: printer.bluetoothMac,
    });

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
      action: 'PRINTER_TEST_PRINTED',
      tenantId,
      actorType: 'USER',
      actorId: userId,
      metadata: {
        printerId: printer.id,
        name: printer.name,
        type: printer.type,
        connectionType: printer.connectionType,
        status,
      },
    });

    return {
      printerId: printer.id,
      name: printer.name,
      type: printer.type,
      connectionType: printer.connectionType,
      paperSize: printer.paperSize,
      bluetoothMac: printer.bluetoothMac,
      ipAddress: printer.ipAddress,
      status,
      escposPayload: result.base64,
      rawText: result.rawText,
    };
  }

  async getRoutingRules(tenantId: string, outletId: string) {
    const outlet = await this.outletRepository.findOne({
      where: { id: outletId, tenantId },
    });

    if (!outlet) {
      throw new NotFoundException({
        success: false,
        message: 'Outlet not found',
        code: 'OUTLET_NOT_FOUND',
      });
    }

    const [categories, printers, routings] = await Promise.all([
      this.categoryRepository.find({
        where: { tenantId, status: 'ACTIVE' },
        order: { name: 'ASC' },
      }),
      this.printerRepository.find({
        where: { tenantId, outletId, status: 'ACTIVE' },
        order: { name: 'ASC' },
      }),
      this.routingRepository.find({
        where: { tenantId, outletId },
        relations: ['printer', 'category'],
      }),
    ]);

    const routingMap = new Map<string, PrinterCategoryRouting>();
    for (const r of routings) {
      routingMap.set(r.categoryId, r);
    }

    const rules = categories.map((cat) => {
      const routing = routingMap.get(cat.id);
      return {
        categoryId: cat.id,
        categoryName: cat.name,
        printerId: routing?.printerId ?? null,
        printerName: routing?.printer?.name ?? null,
        stationType: routing?.printer?.type ?? null,
      };
    });

    return {
      outletId,
      printers: printers.map((p) => ({
        id: p.id,
        name: p.name,
        type: p.type,
        connectionType: p.connectionType,
        isDefault: p.isDefault,
      })),
      rules,
    };
  }

  async setRoutingRules(
    tenantId: string,
    dto: UpdatePrinterRoutingDto,
    userId: string,
  ) {
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

    if (dto.routings.length > 0) {
      const printerIds = [...new Set(dto.routings.map((r) => r.printerId))];
      const categoryIds = [...new Set(dto.routings.map((r) => r.categoryId))];

      const [validPrinters, validCategories] = await Promise.all([
        this.printerRepository.find({
          where: { id: In(printerIds), tenantId, outletId: dto.outletId },
        }),
        this.categoryRepository.find({
          where: { id: In(categoryIds), tenantId },
        }),
      ]);

      if (validPrinters.length !== printerIds.length) {
        throw new BadRequestException({
          success: false,
          message:
            'One or more specified printers do not belong to this outlet',
          code: 'INVALID_PRINTER_SELECTION',
        });
      }

      if (validCategories.length !== categoryIds.length) {
        throw new BadRequestException({
          success: false,
          message: 'One or more specified categories are invalid',
          code: 'INVALID_CATEGORY_SELECTION',
        });
      }
    }

    return this.dataSource.transaction(async (manager) => {
      const routingRepo = manager.getRepository(PrinterCategoryRouting);

      // Remove existing routings for outlet
      await routingRepo.delete({ tenantId, outletId: dto.outletId });

      // Insert new routings
      if (dto.routings.length > 0) {
        const entities = dto.routings.map((r) =>
          routingRepo.create({
            tenantId,
            outletId: dto.outletId,
            printerId: r.printerId,
            categoryId: r.categoryId,
          }),
        );
        await routingRepo.save(entities);
      }

      await this.audit.record({
        action: 'PRINTER_ROUTING_UPDATED',
        tenantId,
        actorType: 'USER',
        actorId: userId,
        metadata: {
          outletId: dto.outletId,
          routingCount: dto.routings.length,
        },
      });

      return this.getRoutingRules(tenantId, dto.outletId);
    });
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

  async dispatchOrder(
    tenantId: string,
    orderId: string,
    dto: DispatchOrderDto,
    userId: string,
    cashierName?: string,
  ) {
    const order = await this.orderRepository.findOne({
      where: { id: orderId, tenantId },
      relations: ['items', 'items.product', 'tenant', 'outlet', 'table'],
    });

    if (!order) {
      throw new NotFoundException({
        success: false,
        message: 'Order not found',
        code: 'ORDER_NOT_FOUND',
      });
    }

    const activePrinters = await this.printerRepository.find({
      where: { tenantId, outletId: order.outletId, status: 'ACTIVE' },
    });

    if (activePrinters.length === 0) {
      throw new NotFoundException({
        success: false,
        message: 'No active printers configured for this outlet',
        code: 'NO_ACTIVE_PRINTERS_FOUND',
      });
    }

    const mode = dto.mode || 'AUTO';
    const printJobs: PrintJobResult[] = [];

    // Specific mode override
    if (mode === 'RECEIPT') {
      const receiptJob = await this.printOrder(
        tenantId,
        orderId,
        { type: 'RECEIPT' },
        userId,
        cashierName,
      );
      return {
        orderId: order.id,
        orderNumber: order.orderNumber,
        isSinglePrinterMode: activePrinters.length === 1,
        printJobs: [
          {
            printerId: receiptJob.printerId,
            printerName: receiptJob.printerName,
            station: receiptJob.type,
            connectionType: receiptJob.connectionType,
            paperSize: receiptJob.paperSize,
            bluetoothMac: null,
            ipAddress: null,
            status: receiptJob.status,
            itemCount: order.items?.length || 0,
            escposPayload: receiptJob.escposPayload,
            rawText: receiptJob.rawText,
          },
        ],
      };
    }

    // SCENARIO 1: Single Active Printer (UMKM / 1-Printer Setup)
    if (activePrinters.length === 1) {
      const singlePrinter = activePrinters[0];
      const payments = await this.paymentRepository.find({
        where: { orderId: order.id, tenantId },
      });
      const settings = await this.settingsService.getSettings(
        tenantId,
        order.outletId,
      );

      let result: EscPosResult;
      let stationTitle = 'RECEIPT';
      if (order.status === 'COMPLETED' || payments.length > 0) {
        result = this.escposBuilder.buildReceipt({
          order,
          payments,
          cashierName: cashierName ?? 'Kasir',
          paperSize: singlePrinter.paperSize,
          footerNote: settings.billFooterText || undefined,
          taxName: settings.taxName || undefined,
        });
      } else {
        result = this.escposBuilder.buildStationTicket({
          order,
          title: '*** TIKET PESANAN ***',
          paperSize: singlePrinter.paperSize,
        });
        stationTitle = singlePrinter.type;
      }

      let status = 'READY_TO_PRINT';
      if (
        singlePrinter.connectionType === 'NETWORK' &&
        singlePrinter.ipAddress
      ) {
        try {
          await this.networkPrinterDriver.send({
            ipAddress: singlePrinter.ipAddress,
            port: singlePrinter.port ?? 9100,
            data: result.buffer,
          });
          status = 'SENT';
        } catch {
          status = 'NETWORK_ERROR';
        }
      }

      printJobs.push({
        printerId: singlePrinter.id,
        printerName: singlePrinter.name,
        station: stationTitle,
        connectionType: singlePrinter.connectionType,
        paperSize: singlePrinter.paperSize,
        bluetoothMac: singlePrinter.bluetoothMac,
        ipAddress: singlePrinter.ipAddress,
        status,
        itemCount: order.items?.length || 0,
        escposPayload: result.base64,
        rawText: result.rawText,
      });

      await this.audit.record({
        action: 'ORDER_DISPATCH_PRINTED',
        tenantId,
        actorType: 'USER',
        actorId: userId,
        metadata: {
          orderId: order.id,
          orderNumber: order.orderNumber,
          isSinglePrinterMode: true,
          jobCount: 1,
        },
      });

      return {
        orderId: order.id,
        orderNumber: order.orderNumber,
        isSinglePrinterMode: true,
        printJobs,
      };
    }

    // SCENARIO 2: Multi-Printer Setup (Station & Category Routing)
    const [routings, settings, payments] = await Promise.all([
      this.routingRepository.find({
        where: { tenantId, outletId: order.outletId },
        relations: ['printer'],
      }),
      this.settingsService.getSettings(tenantId, order.outletId),
      this.paymentRepository.find({ where: { orderId: order.id, tenantId } }),
    ]);

    const routingMap = new Map<string, Printer>();
    for (const r of routings) {
      if (r.printer && r.printer.status === 'ACTIVE') {
        routingMap.set(r.categoryId, r.printer);
      }
    }

    const defaultKitchenPrinter =
      activePrinters.find((p) => p.type === 'KITCHEN' && p.isDefault) ||
      activePrinters.find((p) => p.type === 'KITCHEN');
    const defaultBarPrinter =
      activePrinters.find((p) => p.type === 'BAR' && p.isDefault) ||
      activePrinters.find((p) => p.type === 'BAR');
    const defaultReceiptPrinter =
      activePrinters.find((p) => p.type === 'RECEIPT' && p.isDefault) ||
      activePrinters.find((p) => p.type === 'RECEIPT');
    const fallbackPrinter =
      defaultKitchenPrinter ||
      defaultReceiptPrinter ||
      defaultBarPrinter ||
      activePrinters[0];

    // Group order items by assigned printer
    const itemsByPrinterId = new Map<
      string,
      { printer: Printer; items: OrderItem[] }
    >();

    const orderItems = order.items || [];
    for (const item of orderItems) {
      const categoryId = item.product?.categoryId;
      let targetPrinter: Printer | undefined;

      if (categoryId && routingMap.has(categoryId)) {
        targetPrinter = routingMap.get(categoryId);
      } else {
        // Fallback heuristic if not routed
        targetPrinter = defaultKitchenPrinter || fallbackPrinter;
      }

      if (targetPrinter) {
        if (!itemsByPrinterId.has(targetPrinter.id)) {
          itemsByPrinterId.set(targetPrinter.id, {
            printer: targetPrinter,
            items: [],
          });
        }
        itemsByPrinterId.get(targetPrinter.id)!.items.push(item);
      }
    }

    // Generate station tickets for each station printer with items
    for (const [, group] of itemsByPrinterId.entries()) {
      let result: EscPosResult;
      const targetStation = group.printer.type;

      if (targetStation === 'KITCHEN') {
        result = this.escposBuilder.buildKitchenTicket({
          order,
          items: group.items,
          paperSize: group.printer.paperSize,
        });
      } else if (targetStation === 'BAR') {
        result = this.escposBuilder.buildBarTicket({
          order,
          items: group.items,
          paperSize: group.printer.paperSize,
        });
      } else {
        result = this.escposBuilder.buildStationTicket({
          order,
          items: group.items,
          title: `*** TIKET ${group.printer.name.toUpperCase()} ***`,
          paperSize: group.printer.paperSize,
        });
      }

      let status = 'READY_TO_PRINT';
      if (
        group.printer.connectionType === 'NETWORK' &&
        group.printer.ipAddress
      ) {
        try {
          await this.networkPrinterDriver.send({
            ipAddress: group.printer.ipAddress,
            port: group.printer.port ?? 9100,
            data: result.buffer,
          });
          status = 'SENT';
        } catch {
          status = 'NETWORK_ERROR';
        }
      }

      printJobs.push({
        printerId: group.printer.id,
        printerName: group.printer.name,
        station: targetStation,
        connectionType: group.printer.connectionType,
        paperSize: group.printer.paperSize,
        bluetoothMac: group.printer.bluetoothMac,
        ipAddress: group.printer.ipAddress,
        status,
        itemCount: group.items.length,
        escposPayload: result.base64,
        rawText: result.rawText,
      });
    }

    // Generate Customer Receipt if order is completed and receipt printer is configured
    if (order.status === 'COMPLETED' && defaultReceiptPrinter) {
      const receiptResult = this.escposBuilder.buildReceipt({
        order,
        payments,
        cashierName: cashierName ?? 'Kasir',
        paperSize: defaultReceiptPrinter.paperSize,
        footerNote: settings.billFooterText || undefined,
        taxName: settings.taxName || undefined,
      });

      let status = 'READY_TO_PRINT';
      if (
        defaultReceiptPrinter.connectionType === 'NETWORK' &&
        defaultReceiptPrinter.ipAddress
      ) {
        try {
          await this.networkPrinterDriver.send({
            ipAddress: defaultReceiptPrinter.ipAddress,
            port: defaultReceiptPrinter.port ?? 9100,
            data: receiptResult.buffer,
          });
          status = 'SENT';
        } catch {
          status = 'NETWORK_ERROR';
        }
      }

      printJobs.push({
        printerId: defaultReceiptPrinter.id,
        printerName: defaultReceiptPrinter.name,
        station: 'RECEIPT',
        connectionType: defaultReceiptPrinter.connectionType,
        paperSize: defaultReceiptPrinter.paperSize,
        bluetoothMac: defaultReceiptPrinter.bluetoothMac,
        ipAddress: defaultReceiptPrinter.ipAddress,
        status,
        itemCount: orderItems.length,
        escposPayload: receiptResult.base64,
        rawText: receiptResult.rawText,
      });
    }

    await this.audit.record({
      action: 'ORDER_DISPATCH_PRINTED',
      tenantId,
      actorType: 'USER',
      actorId: userId,
      metadata: {
        orderId: order.id,
        orderNumber: order.orderNumber,
        isSinglePrinterMode: false,
        jobCount: printJobs.length,
      },
    });

    return {
      orderId: order.id,
      orderNumber: order.orderNumber,
      isSinglePrinterMode: false,
      printJobs,
    };
  }
}
