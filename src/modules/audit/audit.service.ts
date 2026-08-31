import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog } from './audit-log.entity';

@Injectable()
export class AuditService {
  constructor(
    @InjectRepository(AuditLog) private readonly logs: Repository<AuditLog>,
  ) {}

  record(
    action: string,
    tenantId: string | null,
    actorType: string,
    metadata: Record<string, unknown> = {},
  ) {
    return this.logs.save(
      this.logs.create({ action, tenantId, actorType, metadata }),
    );
  }
}
