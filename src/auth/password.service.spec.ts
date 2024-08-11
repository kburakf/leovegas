import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { PasswordService } from './password.service';
import * as bcrypt from 'bcrypt';

describe('PasswordService', () => {
  let service: PasswordService;
  let configService: ConfigService;
  let bcryptCompareSpy: jest.SpyInstance;
  let bcryptHashSpy: jest.SpyInstance;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PasswordService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue({ bcryptSaltOrRound: '10' }),
          },
        },
      ],
    }).compile();

    service = module.get<PasswordService>(PasswordService);
    configService = module.get<ConfigService>(ConfigService);
    bcryptCompareSpy = jest.spyOn(bcrypt, 'compare');
    bcryptHashSpy = jest.spyOn(bcrypt, 'hash');
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('bcryptSaltRounds', () => {
    it('should return numeric salt rounds', () => {
      jest
        .spyOn(configService, 'get')
        .mockReturnValueOnce({ bcryptSaltOrRound: '10' });
      expect(service.bcryptSaltRounds).toBe(10);
    });

    it('should return string salt rounds if not numeric', () => {
      jest
        .spyOn(configService, 'get')
        .mockReturnValueOnce({ bcryptSaltOrRound: 'some-salt' });
      expect(service.bcryptSaltRounds).toBe('some-salt');
    });
  });

  describe('validatePassword', () => {
    it('should validate a password correctly', async () => {
      const password = 'test123';
      const hashedPassword = 'hashed123';
      bcryptCompareSpy.mockResolvedValue(true);

      const result = await service.validatePassword(password, hashedPassword);
      expect(bcryptCompareSpy).toHaveBeenCalledWith(password, hashedPassword);
      expect(result).toBe(true);
    });
  });

  describe('hashPassword', () => {
    it('should hash a password correctly', async () => {
      const password = 'test123';
      const saltRounds = 10;
      const hashedPassword = 'hashed123';
      bcryptHashSpy.mockResolvedValue(hashedPassword);

      const result = await service.hashPassword(password);
      expect(bcryptHashSpy).toHaveBeenCalledWith(password, saltRounds);
      expect(result).toEqual(hashedPassword);
    });
  });
});
