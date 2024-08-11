import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from './users.service';
import { PrismaService } from 'nestjs-prisma';
import { PasswordService } from '../auth/password.service';
import {
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { User, Role } from '@prisma/client';

describe('UsersService', () => {
  let service: UsersService;
  let prismaService: any;
  let passwordService: jest.Mocked<PasswordService>;

  const testUser: User = {
    id: '1',
    email: 'user@example.com',
    name: 'User',
    password: 'hashedPassword',
    role: Role.USER,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const adminUser: User = {
    ...testUser,
    id: '2',
    role: Role.ADMIN,
  };

  const superAdminUser: User = {
    ...testUser,
    id: '3',
    role: Role.SUPER_ADMIN,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: PrismaService,
          useValue: {
            user: {
              findUnique: jest.fn(),
              update: jest.fn(),
              delete: jest.fn(),
            },
          },
        },
        {
          provide: PasswordService,
          useValue: { validatePassword: jest.fn(), hashPassword: jest.fn() },
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    prismaService = module.get(PrismaService);
    passwordService = module.get(PasswordService);
  });

  describe('updateUser', () => {
    it('throws NotFoundException if user is not found', async () => {
      prismaService.user.findUnique.mockResolvedValue(null);
      await expect(service.updateUser('1', {}, superAdminUser)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws ForbiddenException if non-SUPER_ADMIN tries to update an ADMIN', async () => {
      prismaService.user.findUnique.mockResolvedValue(adminUser);
      await expect(service.updateUser('2', {}, adminUser)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('allows SUPER_ADMIN to update ADMIN', async () => {
      prismaService.user.findUnique.mockResolvedValue(adminUser);
      prismaService.user.update.mockResolvedValue({
        ...adminUser,
        name: 'Updated Admin',
      });
      const updatedUser = await service.updateUser(
        '2',
        { name: 'Updated Admin' },
        superAdminUser,
      );
      expect(updatedUser.name).toEqual('Updated Admin');
    });
  });

  describe('deleteUser', () => {
    it('throws ForbiddenException if trying to delete oneself', async () => {
      await expect(service.deleteUser('1', testUser)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('throws NotFoundException if user does not exist', async () => {
      prismaService.user.findUnique.mockResolvedValue(null);
      await expect(service.deleteUser('999', superAdminUser)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws ForbiddenException if ADMIN tries to delete another ADMIN', async () => {
      prismaService.user.findUnique.mockResolvedValue(adminUser);
      await expect(service.deleteUser('2', adminUser)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('allows SUPER_ADMIN to delete ADMIN', async () => {
      prismaService.user.findUnique.mockResolvedValue(adminUser);
      prismaService.user.delete.mockResolvedValue({});
      await expect(
        service.deleteUser('2', superAdminUser),
      ).resolves.not.toThrow();
    });
  });

  describe('changePassword', () => {
    it('throws BadRequestException if old password is invalid', async () => {
      passwordService.validatePassword.mockResolvedValue(false);
      await expect(
        service.changePassword('1', 'wrongOldPassword', {
          oldPassword: 'wrongOldPassword',
          newPassword: 'newSecure123',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException if new password is same as old', async () => {
      passwordService.validatePassword
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(true);
      await expect(
        service.changePassword('1', 'sameAsOld', {
          oldPassword: 'sameAsOld',
          newPassword: 'sameAsOld',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('updates password if old password is correct and different from new', async () => {
      passwordService.validatePassword
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(false);
      passwordService.hashPassword.mockResolvedValue('newHashedPassword');
      prismaService.user.update.mockResolvedValue({
        ...testUser,
        password: 'newHashedPassword',
      });

      const result = await service.changePassword('1', 'oldPassword', {
        oldPassword: 'oldPassword',
        newPassword: 'newSecure123',
      });
      expect(result.password).toEqual('newHashedPassword');
    });
  });
});
