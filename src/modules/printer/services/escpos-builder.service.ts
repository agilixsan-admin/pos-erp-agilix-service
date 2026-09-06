import { Injectable } from '@nestjs/common';
import { Order } from '../../order/entities/order.entity';
import { Payment } from '../../payment/entities/payment.entity';
import { PrinterPaperSize } from '../entities/printer.entity';

export interface EscPosResult {
  buffer: Buffer;
  base64: string;
  rawText: string;
}

export interface ReceiptData {
  order: Order;
  payments?: Payment[];
  cashierName?: string;
  paperSize?: PrinterPaperSize;
  footerNote?: string;
  taxName?: string;
}

@Injectable()
export class EscPosBuilderService {
  private readonly ESC = 0x1b;
  private readonly GS = 0x1d;

  private readonly CMD_INIT = Buffer.from([this.ESC, 0x40]);
  private readonly CMD_ALIGN_LEFT = Buffer.from([this.ESC, 0x61, 0x00]);
  private readonly CMD_ALIGN_CENTER = Buffer.from([this.ESC, 0x61, 0x01]);
  private readonly CMD_ALIGN_RIGHT = Buffer.from([this.ESC, 0x61, 0x02]);
  private readonly CMD_BOLD_ON = Buffer.from([this.ESC, 0x45, 0x01]);
  private readonly CMD_BOLD_OFF = Buffer.from([this.ESC, 0x45, 0x00]);
  private readonly CMD_DOUBLE_SIZE = Buffer.from([this.GS, 0x21, 0x11]);
  private readonly CMD_DOUBLE_HEIGHT = Buffer.from([this.GS, 0x21, 0x01]);
  private readonly CMD_NORMAL_SIZE = Buffer.from([this.GS, 0x21, 0x00]);
  private readonly CMD_LINE_FEED = Buffer.from([0x0a]);
  private readonly CMD_CUT = Buffer.from([this.GS, 0x56, 0x42, 0x00]);
  private readonly CMD_DRAWER_KICK = Buffer.from([
    this.ESC,
    0x70,
    0x00,
    0x19,
    0xfa,
  ]);

  getColumnWidth(paperSize: PrinterPaperSize): number {
    return paperSize === '80mm' ? 48 : 32;
  }

  private formatCurrency(amount: number): string {
    return `Rp ${Number(amount).toLocaleString('id-ID')}`;
  }

  private padTwoColumns(left: string, right: string, width: number): string {
    const spaceCount = width - left.length - right.length;
    if (spaceCount <= 0) {
      return `${left}\n${right.padStart(width)}`;
    }
    return left + ' '.repeat(spaceCount) + right;
  }

  private padCenter(text: string, width: number): string {
    if (text.length >= width) return text.substring(0, width);
    const leftPad = Math.floor((width - text.length) / 2);
    const rightPad = width - text.length - leftPad;
    return ' '.repeat(leftPad) + text + ' '.repeat(rightPad);
  }

  buildReceipt(data: ReceiptData): EscPosResult {
    const paperSize = data.paperSize || '58mm';
    const width = this.getColumnWidth(paperSize);
    const divider = '-'.repeat(width);

    const buffers: Buffer[] = [];
    const textLines: string[] = [];

    const append = (
      text: string,
      opts?: {
        align?: 'LEFT' | 'CENTER' | 'RIGHT';
        bold?: boolean;
        doubleSize?: boolean;
        doubleHeight?: boolean;
      },
    ) => {
      const lines = text.split('\n');
      for (const line of lines) {
        if (opts?.align === 'CENTER') {
          buffers.push(this.CMD_ALIGN_CENTER);
          textLines.push(this.padCenter(line, width));
        } else if (opts?.align === 'RIGHT') {
          buffers.push(this.CMD_ALIGN_RIGHT);
          textLines.push(line.padStart(width));
        } else {
          buffers.push(this.CMD_ALIGN_LEFT);
          textLines.push(line);
        }

        if (opts?.bold) buffers.push(this.CMD_BOLD_ON);
        if (opts?.doubleSize) buffers.push(this.CMD_DOUBLE_SIZE);
        else if (opts?.doubleHeight) buffers.push(this.CMD_DOUBLE_HEIGHT);

        buffers.push(Buffer.from(line + '\n', 'utf-8'));

        if (opts?.doubleSize || opts?.doubleHeight)
          buffers.push(this.CMD_NORMAL_SIZE);
        if (opts?.bold) buffers.push(this.CMD_BOLD_OFF);
      }
    };

    // Initialize printer
    buffers.push(this.CMD_INIT);

    // Header (Tenant / Outlet Info)
    const tenantName = data.order.tenant?.businessName || 'AGILIX POS';
    append(tenantName, { align: 'CENTER', bold: true, doubleHeight: true });

    const outletName = data.order.outlet?.name || 'OUTLET';
    append(outletName, { align: 'CENTER' });

    if (data.order.outlet?.address) {
      append(data.order.outlet.address, { align: 'CENTER' });
    }

    append(divider);

    // Order Metadata
    const orderDate = data.order.createdAt
      ? new Date(data.order.createdAt).toLocaleString('id-ID')
      : new Date().toLocaleString('id-ID');
    append(`No: ${data.order.orderNumber}`);
    append(`Waktu: ${orderDate}`);

    const cashier = data.cashierName || 'Kasir';
    append(`Kasir: ${cashier}`);

    const tableLabel =
      data.order.orderType === 'DINE_IN'
        ? `Meja: ${data.order.table?.name || data.order.tableNumber || '-'}`
        : 'TAKE AWAY';
    append(
      this.padTwoColumns(`Tipe: ${data.order.orderType}`, tableLabel, width),
    );

    append(divider);

    // Items
    if (data.order.items && data.order.items.length > 0) {
      for (const item of data.order.items) {
        const prodName = item.productName || 'Produk';
        const variantSuffix =
          item.variantName && item.variantName !== prodName
            ? ` (${item.variantName})`
            : '';
        append(prodName + variantSuffix);

        const qtyPrice = `${item.quantity} x ${this.formatCurrency(Number(item.unitPrice))}`;
        const subtotal = this.formatCurrency(Number(item.subtotal));
        append(this.padTwoColumns(`  ${qtyPrice}`, subtotal, width));

        if (item.notes) {
          append(`  * Note: ${item.notes}`);
        }
      }
    }

    append(divider);

    // Totals
    const subtotal = Number(data.order.subtotal);
    const discountAmount = Number(data.order.discountAmount);
    const taxAmount = Number(data.order.taxAmount);
    const totalAmount = Number(data.order.totalAmount);

    append(
      this.padTwoColumns('Subtotal', this.formatCurrency(subtotal), width),
    );
    const packagingFee = Number(data.order.packagingFee || 0);
    if (packagingFee > 0) {
      append(
        this.padTwoColumns(
          'Biaya Kemasan',
          this.formatCurrency(packagingFee),
          width,
        ),
      );
    }
    if (discountAmount > 0) {
      append(
        this.padTwoColumns(
          'Diskon',
          `-${this.formatCurrency(discountAmount)}`,
          width,
        ),
      );
    }
    if (taxAmount > 0) {
      const taxLabel = data.taxName || 'Pajak';
      append(
        this.padTwoColumns(taxLabel, this.formatCurrency(taxAmount), width),
      );
    }
    append(
      this.padTwoColumns('TOTAL', this.formatCurrency(totalAmount), width),
      {
        bold: true,
      },
    );

    // Payments
    if (data.payments && data.payments.length > 0) {
      append(divider);
      for (const pay of data.payments) {
        append(
          this.padTwoColumns(
            `Bayar (${pay.paymentMethod})`,
            this.formatCurrency(Number(pay.amount)),
            width,
          ),
        );
        if (pay.paymentMethod === 'CASH') {
          const change = Number(pay.changeAmount) || 0;
          const cashTendered = Number(pay.amount) + change;
          append(
            this.padTwoColumns(
              'Tunai',
              this.formatCurrency(cashTendered),
              width,
            ),
          );
          if (change > 0) {
            append(
              this.padTwoColumns(
                'Kembalian',
                this.formatCurrency(change),
                width,
              ),
            );
          }
        }
      }
    }

    append(divider);

    // Footer
    const footer = data.footerNote || 'Terima Kasih Atas Kunjungan Anda!';
    append(footer, { align: 'CENTER' });

    // Drawer Kick & Cut paper
    buffers.push(this.CMD_DRAWER_KICK);
    buffers.push(this.CMD_LINE_FEED);
    buffers.push(this.CMD_LINE_FEED);
    buffers.push(this.CMD_LINE_FEED);
    buffers.push(this.CMD_CUT);

    const buffer = Buffer.concat(buffers);
    return {
      buffer,
      base64: buffer.toString('base64'),
      rawText: textLines.join('\n'),
    };
  }

  buildKitchenTicket(data: {
    order: Order;
    paperSize?: PrinterPaperSize;
  }): EscPosResult {
    const paperSize = data.paperSize || '58mm';
    const width = this.getColumnWidth(paperSize);
    const divider = '-'.repeat(width);

    const buffers: Buffer[] = [];
    const textLines: string[] = [];

    const append = (
      text: string,
      opts?: {
        align?: 'LEFT' | 'CENTER';
        bold?: boolean;
        doubleSize?: boolean;
        doubleHeight?: boolean;
      },
    ) => {
      if (opts?.align === 'CENTER') {
        buffers.push(this.CMD_ALIGN_CENTER);
        textLines.push(this.padCenter(text, width));
      } else {
        buffers.push(this.CMD_ALIGN_LEFT);
        textLines.push(text);
      }

      if (opts?.bold) buffers.push(this.CMD_BOLD_ON);
      if (opts?.doubleSize) buffers.push(this.CMD_DOUBLE_SIZE);
      else if (opts?.doubleHeight) buffers.push(this.CMD_DOUBLE_HEIGHT);

      buffers.push(Buffer.from(text + '\n', 'utf-8'));

      if (opts?.doubleSize || opts?.doubleHeight)
        buffers.push(this.CMD_NORMAL_SIZE);
      if (opts?.bold) buffers.push(this.CMD_BOLD_OFF);
    };

    buffers.push(this.CMD_INIT);

    append('*** TIKET DAPUR ***', {
      align: 'CENTER',
      bold: true,
      doubleHeight: true,
    });
    append(divider);

    append(`No: ${data.order.orderNumber}`, { bold: true });
    const tableLabel =
      data.order.orderType === 'DINE_IN'
        ? `Meja: ${data.order.table?.name || data.order.tableNumber || '-'}`
        : 'TAKE AWAY';
    append(`Tipe: ${data.order.orderType} (${tableLabel})`, { bold: true });

    const orderTime = data.order.createdAt
      ? new Date(data.order.createdAt).toLocaleTimeString('id-ID')
      : new Date().toLocaleTimeString('id-ID');
    append(`Waktu: ${orderTime}`);

    append(divider);

    if (data.order.items && data.order.items.length > 0) {
      for (const item of data.order.items) {
        const prodName = item.productName || 'Produk';
        const variantSuffix =
          item.variantName && item.variantName !== prodName
            ? ` (${item.variantName})`
            : '';
        append(`${item.quantity}x ${prodName}${variantSuffix}`, {
          bold: true,
          doubleHeight: true,
        });

        if (item.notes) {
          append(`   >> Catatan: ${item.notes}`, { bold: true });
        }
      }
    }

    append(divider);

    buffers.push(this.CMD_LINE_FEED);
    buffers.push(this.CMD_LINE_FEED);
    buffers.push(this.CMD_LINE_FEED);
    buffers.push(this.CMD_CUT);

    const buffer = Buffer.concat(buffers);
    return {
      buffer,
      base64: buffer.toString('base64'),
      rawText: textLines.join('\n'),
    };
  }

  buildBarTicket(data: {
    order: Order;
    paperSize?: PrinterPaperSize;
  }): EscPosResult {
    const paperSize = data.paperSize || '58mm';
    const width = this.getColumnWidth(paperSize);
    const divider = '-'.repeat(width);

    const buffers: Buffer[] = [];
    const textLines: string[] = [];

    const append = (
      text: string,
      opts?: {
        align?: 'LEFT' | 'CENTER';
        bold?: boolean;
        doubleSize?: boolean;
        doubleHeight?: boolean;
      },
    ) => {
      if (opts?.align === 'CENTER') {
        buffers.push(this.CMD_ALIGN_CENTER);
        textLines.push(this.padCenter(text, width));
      } else {
        buffers.push(this.CMD_ALIGN_LEFT);
        textLines.push(text);
      }

      if (opts?.bold) buffers.push(this.CMD_BOLD_ON);
      if (opts?.doubleSize) buffers.push(this.CMD_DOUBLE_SIZE);
      else if (opts?.doubleHeight) buffers.push(this.CMD_DOUBLE_HEIGHT);

      buffers.push(Buffer.from(text + '\n', 'utf-8'));

      if (opts?.doubleSize || opts?.doubleHeight)
        buffers.push(this.CMD_NORMAL_SIZE);
      if (opts?.bold) buffers.push(this.CMD_BOLD_OFF);
    };

    buffers.push(this.CMD_INIT);

    append('*** TIKET BAR ***', {
      align: 'CENTER',
      bold: true,
      doubleHeight: true,
    });
    append(divider);

    append(`No: ${data.order.orderNumber}`, { bold: true });
    const tableLabel =
      data.order.orderType === 'DINE_IN'
        ? `Meja: ${data.order.table?.name || data.order.tableNumber || '-'}`
        : 'TAKE AWAY';
    append(`Tipe: ${data.order.orderType} (${tableLabel})`, { bold: true });

    const orderTime = data.order.createdAt
      ? new Date(data.order.createdAt).toLocaleTimeString('id-ID')
      : new Date().toLocaleTimeString('id-ID');
    append(`Waktu: ${orderTime}`);

    append(divider);

    if (data.order.items && data.order.items.length > 0) {
      for (const item of data.order.items) {
        const prodName = item.productName || 'Minuman';
        const variantSuffix =
          item.variantName && item.variantName !== prodName
            ? ` (${item.variantName})`
            : '';
        append(`${item.quantity}x ${prodName}${variantSuffix}`, {
          bold: true,
          doubleHeight: true,
        });

        if (item.notes) {
          append(`   >> Catatan: ${item.notes}`, { bold: true });
        }
      }
    }

    append(divider);

    buffers.push(this.CMD_LINE_FEED);
    buffers.push(this.CMD_LINE_FEED);
    buffers.push(this.CMD_LINE_FEED);
    buffers.push(this.CMD_CUT);

    const buffer = Buffer.concat(buffers);
    return {
      buffer,
      base64: buffer.toString('base64'),
      rawText: textLines.join('\n'),
    };
  }
}
