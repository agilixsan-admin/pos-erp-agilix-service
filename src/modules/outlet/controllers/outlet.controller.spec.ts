import { Test, TestingModule } from '@nestjs/testing';
import { OutletController } from './outlet.controller';
import { OutletService } from '../outlet.service';
import { User } from '../../user/user.entity';

describe('OutletController', () => {
  let controller: OutletController;

  const mockUser = {
    id: 'user-1',
    tenantId: 'tenant-1',
    name: 'Ahmad Owner',
    isSuperAdmin: false,
  } as User;

  const mockOutlet = {
    id: '123e4567-e89b-12d3-a456-426614174002',
    tenantId: 'tenant-1',
    name: 'Outlet Utama',
    code: 'OUTLET',
    address: 'Jl. Sudirman No. 1, Jakarta',
    phone: '+628123456789',
    status: 'ACTIVE',
  };

  const mockOutletService = {
    findAll: jest.fn(),
    findById: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [OutletController],
      providers: [
        { provide: OutletService, useValue: mockOutletService },
      ],
    }).compile();

    controller = module.get<OutletController>(OutletController);
  });

  describe('findAll', () => {
    it('returns list of outlets for user tenant', async () => {
      mockOutletService.findAll.mockResolvedValue([mockOutlet]);

      const result = await controller.findAll(mockUser);

      expect(result).toEqual({
        success: true,
        data: [mockOutlet],
      });
      expect(mockOutletService.findAll).toHaveBeenCalledWith('tenant-1');
    });
  });

  describe('findById', () => {
    it('returns single outlet detail', async () => {
      mockOutletService.findById.mockResolvedValue(mockOutlet);

      const result = await controller.findById(mockUser, mockOutlet.id);

      expect(result).toEqual({
        success: true,
        data: mockOutlet,
      });
      expect(mockOutletService.findById).toHaveBeenCalledWith('tenant-1', mockOutlet.id);
    });
  });

  describe('create', () => {
    it('creates new outlet and returns success response', async () => {
      mockOutletService.create.mockResolvedValue(mockOutlet);

      const dto = {
        name: 'Outlet Cabang 2',
        address: 'Jl. Thamrin No. 10, Jakarta',
        phone: '+628123456790',
      };

      const result = await controller.create(mockUser, dto);

      expect(result).toEqual({
        success: true,
        message: 'Outlet created successfully',
        data: mockOutlet,
      });
      expect(mockOutletService.create).toHaveBeenCalledWith('tenant-1', 'user-1', dto);
    });
  });

  describe('update', () => {
    it('updates outlet and returns success response', async () => {
      const updated = { ...mockOutlet, name: 'Outlet Utama Updated' };
      mockOutletService.update.mockResolvedValue(updated);

      const dto = { name: 'Outlet Utama Updated' };

      const result = await controller.update(mockUser, mockOutlet.id, dto);

      expect(result).toEqual({
        success: true,
        message: 'Outlet updated successfully',
        data: updated,
      });
      expect(mockOutletService.update).toHaveBeenCalledWith(
        'tenant-1',
        'user-1',
        mockOutlet.id,
        dto,
      );
    });
  });

  describe('delete', () => {
    it('deletes outlet and returns success response with null data', async () => {
      mockOutletService.delete.mockResolvedValue(undefined);

      const result = await controller.delete(mockUser, mockOutlet.id);

      expect(result).toEqual({
        success: true,
        message: 'Outlet deleted successfully',
        data: null,
      });
      expect(mockOutletService.delete).toHaveBeenCalledWith(
        'tenant-1',
        'user-1',
        mockOutlet.id,
      );
    });
  });
});

