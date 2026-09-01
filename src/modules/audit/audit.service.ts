import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { AuditLog } from './audit-log.entity';
import { QueryAuditLogDto } from './dto/query-audit-log.dto';

export interface AuditRecordOptions {
  action: string;
  tenantId: string | null;
  actorType: string;
  actorId?: string | null;
  metadata?: Record<string, unknown>;
}

export interface PaginatedAuditLogs {
  data: AuditLog[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

@Injectable()
export class AuditService {
  constructor(
    @InjectRepository(AuditLog)
    private readonly logs: Repository<AuditLog>,
  ) {}

  /**
   * Record an audit log entry.
   * Pass an EntityManager when calling from within an existing transaction
   * to ensure the audit record participates in the same transaction.
   */
  record(
    options: AuditRecordOptions,
    manager?: EntityManager,
  ): Promise<AuditLog> {
    const repo = manager ? manager.getRepository(AuditLog) : this.logs;
    return repo.save(
      repo.create({
        action: options.action,
        tenantId: options.tenantId,
        actorType: options.actorType,
        actorId: options.actorId ?? null,
        metadata: options.metadata ?? {},
      }),
    );
  }

  /**
   * Retrieve paginated audit logs scoped to a tenant.
   */
  async findAll(
    tenantId: string,
    query: QueryAuditLogDto,
  ): Promise<PaginatedAuditLogs> {
    const {
      page = 1,
      limit = 20,
      action,
      actorType,
      actorId,
      startDate,
      endDate,
    } = query;

    const qb = this.logs
      .createQueryBuilder('log')
      .where('log.tenant_id = :tenantId', { tenantId })
      .orderBy('log.created_at', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    if (action) {
      qb.andWhere('log.action = :action', { action });
    }

    if (actorType) {
      qb.andWhere('log.actor_type = :actorType', { actorType });
    }

    if (actorId) {
      qb.andWhere('log.actor_id = :actorId', { actorId });
    }

    if (startDate) {
      qb.andWhere('log.created_at >= :startDate', { startDate });
    }

    if (endDate) {
      qb.andWhere('log.created_at <= :endDate', { endDate });
    }

    const [data, total] = await qb.getManyAndCount();

    return {
      data,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}
