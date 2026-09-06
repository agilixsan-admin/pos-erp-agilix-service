import 'dotenv/config';
import 'reflect-metadata';
import * as bcrypt from 'bcryptjs';
import dataSource from './data-source';
import { Tenant } from '../modules/tenant/tenant.entity';
import { TenantStatus } from '../modules/tenant/tenant-status.enum';
import { Outlet } from '../modules/outlet/outlet.entity';
import { Role } from '../modules/rbac/role.entity';
import { User } from '../modules/user/user.entity';
import { PosSettings } from '../modules/settings/entities/pos-settings.entity';

async function seed() {
  console.log('[Seed] Connecting to database...');
  await dataSource.initialize();
  console.log('[Seed] Database connected.');

  const tenantRepo = dataSource.getRepository(Tenant);
  const outletRepo = dataSource.getRepository(Outlet);
  const roleRepo = dataSource.getRepository(Role);
  const userRepo = dataSource.getRepository(User);
  const settingsRepo = dataSource.getRepository(PosSettings);

  const defaultEmail = 'owner@testcafe.com';
  let user = await userRepo.findOne({ where: { email: defaultEmail } });

  if (user) {
    console.log(
      `[Seed] User "${defaultEmail}" already exists. Seeding skipped.`,
    );
    await dataSource.destroy();
    return;
  }

  console.log(
    '[Seed] Creating default tenant, outlet, role, settings, and user...',
  );

  let tenant = await tenantRepo.findOne({
    where: { ownerEmail: defaultEmail },
  });
  if (!tenant) {
    tenant = tenantRepo.create({
      businessName: 'Test Cafe',
      ownerName: 'Owner Agilix',
      ownerEmail: defaultEmail,
      ownerPhone: '081234567890',
      planType: 'ENTERPRISE',
      status: TenantStatus.ACTIVE,
    });
    await tenantRepo.save(tenant);
    console.log(
      `[Seed] Created tenant: "${tenant.businessName}" (${tenant.id})`,
    );
  }

  let outlet = await outletRepo.findOne({
    where: { tenantId: tenant.id, code: 'OUT-01' },
  });
  if (!outlet) {
    outlet = outletRepo.create({
      tenantId: tenant.id,
      name: 'Outlet Utama',
      code: 'OUT-01',
      address: 'Jl. Sudirman No. 1, Jakarta',
      status: 'ACTIVE',
    });
    await outletRepo.save(outlet);
    console.log(`[Seed] Created outlet: "${outlet.name}" (${outlet.id})`);
  }

  let role = await roleRepo.findOne({
    where: { tenantId: tenant.id, outletId: outlet.id, name: 'Super Admin' },
  });
  if (!role) {
    role = roleRepo.create({
      tenantId: tenant.id,
      outletId: outlet.id,
      name: 'Super Admin',
      description: 'Super Administrator dengan akses penuh',
      menuAccess: ['*'],
      status: 'ACTIVE',
    });
    await roleRepo.save(role);
    console.log(`[Seed] Created role: "${role.name}" (${role.id})`);
  }

  const saltRounds = Number(process.env.BCRYPT_SALT_ROUNDS ?? 12);
  const passwordHash = await bcrypt.hash('Password123!', saltRounds);

  user = userRepo.create({
    tenantId: tenant.id,
    outletId: outlet.id,
    roleId: role.id,
    name: 'Owner Test Cafe',
    email: defaultEmail,
    passwordHash,
    isSuperAdmin: true,
    status: 'ACTIVE',
  });
  await userRepo.save(user);
  console.log(
    `[Seed] Created user: "${user.email}" with password "Password123!"`,
  );

  let settings = await settingsRepo.findOne({
    where: { tenantId: tenant.id, outletId: outlet.id },
  });
  if (!settings) {
    settings = settingsRepo.create({
      tenantId: tenant.id,
      outletId: outlet.id,
      taxEnabled: true,
      taxRate: 10,
      taxName: 'PB1',
      discountEnabled: true,
      discountType: 'PERCENTAGE',
      discountValue: 0,
      cashEnabled: true,
      qrisEnabled: true,
      billFooterText: 'Terima kasih atas kunjungan Anda di Test Cafe!',
    });
    await settingsRepo.save(settings);
    console.log(`[Seed] Created POS Settings for outlet: ${outlet.name}`);
  }

  console.log('[Seed] Seeding completed successfully!');
  console.log('====================================================');
  console.log('  Login Credentials for Swagger:');
  console.log('  Email    : owner@testcafe.com');
  console.log('  Password : Password123!');
  console.log('====================================================');

  await dataSource.destroy();
}

seed().catch((err) => {
  console.error('[Seed] Error during seeding:', err);
  process.exit(1);
});
