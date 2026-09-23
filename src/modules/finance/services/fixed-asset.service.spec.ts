import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { FixedAssetService } from './fixed-asset.service';
import { FixedAsset } from '../entities/fixed-asset.entity';
import { FinancialAccount } from '../entities/financial-account.entity';
import { JournalService } from './journal.service';

describe('FixedAssetService', () => {
  let service: FixedAssetService;
  let mockAssetRepo: any;
  let mockAccountRepo: any;
  let mockJournalService: any;
  let mockDataSource: any;

  beforeEach(async () => {
    mockAssetRepo = {
      createQueryBuilder: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn((dto) => dto),
      save: jest.fn((dto) => Promise.resolve({ id: 'asset-1', ...dto })),
    };

    mockAccountRepo = {
      findOne: jest.fn(),
    };

    mockJournalService = {
      recordJournal: jest.fn().mockResolvedValue({ id: 'jrn-1' }),
    };

    mockDataSource = {
      transaction: jest.fn((cb) =>
        cb({
          getRepository: (entity: any) => {
            if (entity === FixedAsset) return mockAssetRepo;
            if (entity === FinancialAccount) return mockAccountRepo;
            return {
              save: jest.fn((v) => Promise.resolve(v)),
              create: jest.fn((v) => v),
            };
          },
          save: jest.fn((v) => Promise.resolve(v)),
        }),
      ),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FixedAssetService,
        { provide: getRepositoryToken(FixedAsset), useValue: mockAssetRepo },
        {
          provide: getRepositoryToken(FinancialAccount),
          useValue: mockAccountRepo,
        },
        { provide: JournalService, useValue: mockJournalService },
        { provide: DataSource, useValue: mockDataSource },
      ],
    }).compile();

    service = module.get<FixedAssetService>(FixedAssetService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should calculate straight-line depreciation accurately', async () => {
    // Mesin Kopi seharga 48.000.000, masa pakai 48 bulan (1.000.000/bln), dibeli 10 bulan lalu
    const purchaseDate = new Date();
    purchaseDate.setMonth(purchaseDate.getMonth() - 10);

    const mockAssets = [
      {
        id: 'asset-1',
        tenantId: 'tenant-1',
        outletId: 'outlet-1',
        name: 'Mesin Espresso',
        category: 'Mesin & Peralatan',
        purchaseDate: purchaseDate.toISOString().slice(0, 10),
        purchaseCost: 48000000,
        usefulLifeMonths: 48,
        salvageValue: 0,
        status: 'ACTIVE',
      },
    ];

    mockAssetRepo.createQueryBuilder.mockReturnValue({
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue(mockAssets),
    });

    const result = await service.getAssets('tenant-1');

    expect(result).toHaveLength(1);
    expect(result[0].monthlyDepreciation).toBe(1000000);
    expect(result[0].monthsElapsed).toBe(10);
    expect(result[0].accumulatedDepreciation).toBe(10000000);
    expect(result[0].currentBookValue).toBe(38000000);
  });
});
