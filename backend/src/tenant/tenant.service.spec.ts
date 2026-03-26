import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { TenantService } from './tenant.service';
import { Tenant } from './entities/tenant.entity';

const mockTenant = (): Tenant => ({
  id: 'uuid-1',
  name: 'Test Company',
  slug: 'test-company',
  isActive: true,
  settings: null,
  createdAt: new Date(),
  updatedAt: new Date(),
});

describe('TenantService', () => {
  let service: TenantService;
  let repo: jest.Mocked<Repository<Tenant>>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TenantService,
        {
          provide: getRepositoryToken(Tenant),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            find: jest.fn(),
            findOne: jest.fn(),
            remove: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<TenantService>(TenantService);
    repo = module.get(getRepositoryToken(Tenant));
  });

  describe('create', () => {
    it('should create a tenant successfully', async () => {
      const dto = { name: 'Test Company', slug: 'test-company' };
      const tenant = mockTenant();

      repo.findOne.mockResolvedValue(null);
      repo.create.mockReturnValue(tenant);
      repo.save.mockResolvedValue(tenant);

      const result = await service.create(dto);

      expect(repo.findOne).toHaveBeenCalledWith({ where: { slug: dto.slug } });
      expect(result).toEqual(tenant);
    });

    it('should throw ConflictException if slug already exists', async () => {
      const dto = { name: 'Another Company', slug: 'test-company' };
      repo.findOne.mockResolvedValue(mockTenant());

      await expect(service.create(dto)).rejects.toThrow(ConflictException);
    });
  });

  describe('findOne', () => {
    it('should return a tenant by id', async () => {
      const tenant = mockTenant();
      repo.findOne.mockResolvedValue(tenant);

      const result = await service.findOne('uuid-1');
      expect(result).toEqual(tenant);
    });

    it('should throw NotFoundException if tenant not found', async () => {
      repo.findOne.mockResolvedValue(null);

      await expect(service.findOne('non-existent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('should update tenant name', async () => {
      const tenant = mockTenant();
      const updated = { ...tenant, name: 'New Name' };

      repo.findOne.mockResolvedValue(tenant);
      repo.save.mockResolvedValue(updated);

      const result = await service.update('uuid-1', { name: 'New Name' });
      expect(result.name).toBe('New Name');
    });

    it('should throw ConflictException if new slug already taken', async () => {
      const tenant = mockTenant();
      const otherTenant = { ...mockTenant(), id: 'uuid-2', slug: 'taken-slug' };

      repo.findOne
        .mockResolvedValueOnce(tenant)        // findOne for the tenant being updated
        .mockResolvedValueOnce(otherTenant);  // findOne for slug conflict check

      await expect(
        service.update('uuid-1', { slug: 'taken-slug' }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('remove', () => {
    it('should remove a tenant', async () => {
      const tenant = mockTenant();
      repo.findOne.mockResolvedValue(tenant);
      repo.remove.mockResolvedValue(tenant);

      await expect(service.remove('uuid-1')).resolves.not.toThrow();
    });
  });

  describe('activate / deactivate', () => {
    it('should activate a tenant', async () => {
      const tenant = { ...mockTenant(), isActive: false };
      const activated = { ...tenant, isActive: true };

      repo.findOne.mockResolvedValue(tenant);
      repo.save.mockResolvedValue(activated);

      const result = await service.activate('uuid-1');
      expect(result.isActive).toBe(true);
    });
  });
});
