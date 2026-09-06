import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource, IsNull } from 'typeorm';
import { ConsoleWebhookDto } from './console-webhook.dto';
import { ExternalCommand } from './external-command.entity';
import { Tenant } from '../tenant/tenant.entity';
import { Outlet } from '../outlet/outlet.entity';
import { PosSettings } from '../settings/entities/pos-settings.entity';
import { AuditService } from '../audit/audit.service';
import { TenantStatus } from '../tenant/tenant-status.enum';
import { Role } from '../rbac/role.entity';
import { User } from '../user/user.entity';
import * as bcrypt from 'bcryptjs';

const supportedEvents = new Set([
  'tenant.created',
  'tenant.updated',
  'tenant.locked',
  'tenant.unlocked',
  'tenant.deleted',
]);

@Injectable()
export class WebhookService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly config: ConfigService,
    private readonly audit: AuditService,
  ) {}

  async process(payload: ConsoleWebhookDto, apiKey: string | undefined) {
    this.verifyApiKey(apiKey);
    if (!supportedEvents.has(payload.event)) {
      throw new BadRequestException({
        success: false,
        message: 'Unsupported event',
        code: 'UNSUPPORTED_EVENT',
      });
    }
    const tenantId = this.getTenantId(payload);
    return this.dataSource.transaction(async (manager) => {
      const commandRepository = manager.getRepository(ExternalCommand);
      const existing = await commandRepository.findOne({
        where: { eventId: payload.eventId },
      });
      if (existing)
        return { success: true, message: 'Event already processed' };

      const tenantRepository = manager.getRepository(Tenant);
      let tenant = await tenantRepository.findOne({ where: { id: tenantId } });
      if (payload.event === 'tenant.created') {
        if (!tenant) {
          tenant = tenantRepository.create({
            id: tenantId,
            businessName: this.requiredString(
              payload.data.businessName,
              'businessName',
            ),
            ownerName: this.requiredString(payload.data.ownerName, 'ownerName'),
            ownerEmail: this.requiredString(
              payload.data.ownerEmail,
              'ownerEmail',
            ),
            ownerPhone: this.optionalString(payload.data.ownerPhone),
            planType: this.requiredString(payload.data.planType, 'planType'),
            expiryDate: this.parseDate(payload.data.expiryDate),
            status: TenantStatus.ACTIVE,
          });
          await tenantRepository.save(tenant);
          const outletCount = Number(payload.data.outletCount ?? 1);
          if (!Number.isInteger(outletCount) || outletCount < 1) {
            throw new BadRequestException({
              success: false,
              message: 'Invalid outlet count',
              code: 'INVALID_PAYLOAD',
            });
          }
          const outletRepository = manager.getRepository(Outlet);
          const createdOutlets = await outletRepository.save(
            Array.from({ length: outletCount }, (_, index) =>
              outletRepository.create({
                tenantId,
                name: `Outlet ${index + 1}`,
                code: `OUTLET-${index + 1}`,
                status: 'ACTIVE',
              }),
            ),
          );

          const firstOutlet = createdOutlets[0];

          // 1. Provision Default Owner Role (Full POS Access)
          const roleRepository = manager.getRepository(Role);
          let role = await roleRepository.findOne({
            where: { tenantId, name: 'Owner' },
          });
          if (!role) {
            role = await roleRepository.save(
              roleRepository.create({
                tenantId,
                outletId: firstOutlet.id,
                name: 'Owner',
                description: 'Pemilik bisnis dengan akses penuh POS',
                menuAccess: ['*'],
                status: 'ACTIVE',
              }),
            );
          }

          // 2. Provision Default Owner User for POS Login
          const userRepository = manager.getRepository(User);
          const existingUser = await userRepository.findOne({
            where: { email: tenant.ownerEmail },
          });
          if (!existingUser) {
            const rawPassword =
              typeof payload.data.initialPassword === 'string' &&
              payload.data.initialPassword.trim()
                ? payload.data.initialPassword.trim()
                : 'Password123!';
            const saltRounds = Number(process.env.BCRYPT_SALT_ROUNDS ?? 12);
            const passwordHash = await bcrypt.hash(rawPassword, saltRounds);

            await userRepository.save(
              userRepository.create({
                tenantId,
                outletId: firstOutlet.id,
                roleId: role.id,
                name: tenant.ownerName,
                email: tenant.ownerEmail,
                passwordHash,
                isSuperAdmin: true,
                status: 'ACTIVE',
              }),
            );
          }

          const settingsRepository = manager.getRepository(PosSettings);
          const existingSettings = await settingsRepository.findOne({
            where: { tenantId, outletId: IsNull() },
          });
          if (!existingSettings) {
            await settingsRepository.save(
              settingsRepository.create({
                tenantId,
                outletId: null,
                taxEnabled: false,
                taxRate: 0,
                taxName: 'Tax',
                discountEnabled: false,
                discountType: 'PERCENTAGE',
                discountValue: 0,
                cashEnabled: true,
                qrisEnabled: true,
              }),
            );
          }
        }
      } else {
        if (!tenant)
          throw new ForbiddenException({
            success: false,
            message: 'Tenant not found',
            code: 'TENANT_NOT_FOUND',
          });
        if (
          payload.event === 'tenant.locked' ||
          payload.event === 'tenant.deleted'
        )
          tenant.status = TenantStatus.LOCKED;
        if (payload.event === 'tenant.unlocked')
          tenant.status = TenantStatus.ACTIVE;
        if (payload.event === 'tenant.updated') {
          tenant.businessName =
            this.optionalString(payload.data.businessName) ??
            tenant.businessName;
          tenant.ownerName =
            this.optionalString(payload.data.ownerName) ?? tenant.ownerName;
          tenant.ownerEmail =
            this.optionalString(payload.data.ownerEmail) ?? tenant.ownerEmail;
          tenant.ownerPhone =
            this.optionalString(payload.data.ownerPhone) ?? tenant.ownerPhone;
          tenant.planType =
            this.optionalString(payload.data.planType) ?? tenant.planType;
          if (payload.data.expiryDate)
            tenant.expiryDate = this.parseDate(payload.data.expiryDate);
        }
        await tenantRepository.save(tenant);
      }

      await commandRepository.save(
        commandRepository.create({
          eventId: payload.eventId,
          eventName: payload.event,
          tenantId,
          payload: payload as unknown as Record<string, unknown>,
          status: 'PROCESSED',
          processedAt: new Date(),
        }),
      );

      await this.audit.record(
        {
          action: payload.event,
          tenantId,
          actorType: 'CONSOLE',
          metadata: { eventId: payload.eventId },
        },
        manager,
      );

      return { success: true, message: 'Event processed successfully' };
    });
  }

  private verifyApiKey(apiKey: string | undefined) {
    const expected = this.config.get<string>('console.apiKey');
    if (!apiKey || !expected || apiKey !== expected) {
      throw new UnauthorizedException({
        success: false,
        message: 'Invalid API key',
        code: 'INVALID_API_KEY',
      });
    }
  }

  private getTenantId(payload: ConsoleWebhookDto) {
    const value = payload.data.tenantId;
    if (typeof value !== 'string' || !value)
      throw new BadRequestException({
        success: false,
        message: 'Tenant ID is required',
        code: 'INVALID_PAYLOAD',
      });
    return value;
  }

  private requiredString(value: unknown, field: string) {
    const result = this.optionalString(value);
    if (!result)
      throw new BadRequestException({
        success: false,
        message: `${field} is required`,
        code: 'INVALID_PAYLOAD',
      });
    return result;
  }

  private optionalString(value: unknown) {
    return typeof value === 'string' && value.trim() ? value.trim() : undefined;
  }

  private parseDate(value: unknown) {
    if (typeof value !== 'string') return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }
}
