import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { PrismaService } from 'nestjs-prisma';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PasswordService } from './password.service';
import {
  NotFoundException,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { User } from '@prisma/client';
import { SignupInput } from './dto/signup.input';

describe('AuthService', () => {
  let service: AuthService;
  let prismaService: any;
  let jwtService: jest.Mocked<JwtService>;
  let passwordService: jest.Mocked<PasswordService>;
  let configService: jest.Mocked<ConfigService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: PrismaService,
          useValue: { user: { create: jest.fn(), findUnique: jest.fn() } },
        },
        {
          provide: JwtService,
          useValue: { sign: jest.fn(), decode: jest.fn(), verify: jest.fn() },
        },
        {
          provide: PasswordService,
          useValue: { hashPassword: jest.fn(), validatePassword: jest.fn() },
        },
        { provide: ConfigService, useValue: { get: jest.fn() } },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    prismaService = module.get(PrismaService);
    jwtService = module.get(JwtService);
    passwordService = module.get(PasswordService);
    configService = module.get(ConfigService);
  });

  describe('createUser', () => {
    it('should create a user and return tokens', async () => {
      const signupInput = {
        email: 'test@example.com',
        password: 'Password123!',
      } as SignupInput;
      const hashedPassword = 'hashedPassword123';
      passwordService.hashPassword.mockResolvedValue(hashedPassword);
      prismaService.user.create.mockResolvedValue({
        id: '1',
        email: 'test@example.com',
        password: hashedPassword,
        role: 'USER',
      });
      jest.spyOn(service, 'generateTokens').mockReturnValue({
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
      });

      const result = await service.createUser(signupInput);
      expect(result).toEqual({
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
      });
      expect(prismaService.user.create).toHaveBeenCalledWith({
        data: {
          ...signupInput,
          password: hashedPassword,
          role: 'USER',
        },
      });
    });

    it('should throw a generic error when createUser encounters a non-P2002 database error', async () => {
      const signupInput: SignupInput = {
        email: 'test@example.com',
        password: 'Password123!',
        name: 'Test User',
      };
      const unknownError = new Error('Unknown database error');
      passwordService.hashPassword.mockResolvedValue('hashedPassword123');
      prismaService.user.create.mockRejectedValue(unknownError);

      await expect(service.createUser(signupInput)).rejects.toThrowError(
        new Error('Error: Unknown database error'),
      );
    });
  });

  describe('login', () => {
    it('should throw NotFoundException if user not found', async () => {
      prismaService.user.findUnique.mockResolvedValue(null);
      await expect(
        service.login('nonexistent@example.com', 'Password123!'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if password is invalid', async () => {
      const user = { email: 'test@example.com', password: 'hashedPassword123' };
      prismaService.user.findUnique.mockResolvedValue(user);
      passwordService.validatePassword.mockResolvedValue(false);

      await expect(
        service.login('test@example.com', 'wrongPassword'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should return tokens if login is successful', async () => {
      const user = {
        id: '1',
        email: 'test@example.com',
        password: 'hashedPassword123',
      };
      prismaService.user.findUnique.mockResolvedValue(user);
      passwordService.validatePassword.mockResolvedValue(true);
      jest.spyOn(service, 'generateTokens').mockReturnValue({
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
      });

      const result = await service.login('test@example.com', 'Password123!');
      expect(result).toEqual({
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
      });
    });

    it('should handle unexpected errors during the login process', async () => {
      prismaService.user.findUnique.mockRejectedValue(
        new Error('Database error'),
      );

      await expect(
        service.login('test@example.com', 'Password123!'),
      ).rejects.toThrowError(new Error('Database error'));
    });
  });

  describe('refreshToken', () => {
    it('should generate new tokens if refresh token is valid', async () => {
      jwtService.verify.mockReturnValue({ userId: '1' });
      jest.spyOn(service, 'generateTokens').mockReturnValue({
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
      });

      const result = await service.refreshToken('valid-token');
      expect(result).toEqual({
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
      });
    });
  });

  describe('validateUser', () => {
    it('should return a user if found', async () => {
      const expectedUser: User = {
        id: '1',
        name: 'test',
        email: 'test@example.com',
        password: 'password',
        role: 'USER',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      prismaService.user.findUnique.mockResolvedValue(expectedUser);
      const result = await service.validateUser('1');
      expect(result).toEqual(expectedUser);
    });

    it('should return null if no user is found', async () => {
      prismaService.user.findUnique.mockResolvedValue(null);
      const result = await service.validateUser('non-existent');
      expect(result).toBeNull();
    });
  });

  describe('getUserFromToken', () => {
    it('should retrieve a user based on userId from token', async () => {
      const decodedUserId = { userId: '1' };
      jwtService.decode.mockReturnValue(decodedUserId);
      const expectedUser: User = {
        id: '1',
        name: 'test',
        email: 'test@example.com',
        password: 'password',
        role: 'USER',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      prismaService.user.findUnique.mockResolvedValue(expectedUser);

      const result = await service.getUserFromToken('token');
      expect(jwtService.decode).toHaveBeenCalledWith('token');
      expect(prismaService.user.findUnique).toHaveBeenCalledWith({
        where: { id: '1' },
      });
      expect(result).toEqual(expectedUser);
    });
  });

  describe('generateTokens', () => {
    it('should generate access and refresh tokens', async () => {
      const userId = '1';
      const payload = { userId };
      const accessToken = 'access-token';
      const refreshToken = 'refresh-token';

      jwtService.sign
        .mockReturnValueOnce(accessToken)
        .mockReturnValueOnce(refreshToken);

      configService.get.mockReturnValueOnce('JWT_REFRESH_SECRET');

      const result = await service.generateTokens(payload);
      expect(result).toEqual({ accessToken, refreshToken });
      expect(jwtService.sign).toHaveBeenCalledTimes(2);
      expect(jwtService.sign).toHaveBeenCalledWith(payload, expect.anything());
    });
  });
});
