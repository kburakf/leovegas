import { PrismaService } from 'nestjs-prisma';
import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PasswordService } from '../auth/password.service';
import { ChangePasswordInput } from './dto/change-password.input';
import { UpdateUserInput } from './dto/update-user.input';
import { User } from './models/user.model';
import { Role } from '@prisma/client';

@Injectable()
export class UsersService {
  constructor(
    private prisma: PrismaService,
    private passwordService: PasswordService,
  ) {}

  async updateUser(
    userId: string,
    newUserData: UpdateUserInput,
    currentUser: User,
  ): Promise<User> {
    const userToUpdate = await this.findById(userId);
    if (!userToUpdate) {
      throw new NotFoundException('User not found');
    }

    if (
      currentUser.role !== Role.SUPER_ADMIN &&
      userToUpdate.role === Role.ADMIN
    ) {
      throw new ForbiddenException(
        'You do not have permission to update another admin',
      );
    }

    if (newUserData.role && userId === currentUser.id) {
      throw new ForbiddenException('You cannot change your own role');
    }

    if (
      currentUser.role !== Role.ADMIN &&
      currentUser.role !== Role.SUPER_ADMIN &&
      userId !== currentUser.id
    ) {
      throw new ForbiddenException(
        'You do not have permission to perform this action',
      );
    }

    return this.prisma.user.update({
      data: newUserData,
      where: { id: userId },
    });
  }

  async findAll(user): Promise<User[]> {
    if (user.role === Role.SUPER_ADMIN) {
      return this.prisma.user.findMany();
    }

    if (user.role === Role.ADMIN) {
      return this.prisma.user.findMany({
        where: {
          NOT: {
            role: Role.SUPER_ADMIN,
          },
        },
      });
    }
  }

  async findById(id: string): Promise<User> {
    return this.prisma.user.findUnique({ where: { id } });
  }

  async changePassword(
    userId: string,
    userPassword: string,
    changePassword: ChangePasswordInput,
  ) {
    const passwordValid = await this.passwordService.validatePassword(
      changePassword.oldPassword,
      userPassword,
    );

    if (!passwordValid) {
      throw new BadRequestException('Invalid password');
    }

    const isSameAsOld = await this.passwordService.validatePassword(
      changePassword.newPassword,
      userPassword,
    );

    if (isSameAsOld) {
      throw new BadRequestException(
        'New password cannot be the same as the old password.',
      );
    }

    const hashedPassword = await this.passwordService.hashPassword(
      changePassword.newPassword,
    );

    return this.prisma.user.update({
      data: {
        password: hashedPassword,
      },
      where: { id: userId },
    });
  }

  async deleteUser(userId: string, currentUser: User): Promise<void> {
    if (userId === currentUser.id) {
      throw new ForbiddenException('You cannot delete yourself');
    }

    const userToDelete = await this.findById(userId);

    if (!userToDelete) {
      throw new NotFoundException('User not found');
    }

    if (
      userToDelete.role === Role.ADMIN &&
      currentUser.role !== Role.SUPER_ADMIN
    ) {
      throw new ForbiddenException(
        'You do not have permission to delete another admin',
      );
    }

    await this.prisma.user.delete({ where: { id: userId } });
  }
}
