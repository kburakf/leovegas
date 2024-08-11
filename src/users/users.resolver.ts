import { Resolver, Query, Mutation, Args } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { UserEntity } from '../common/decorators/user.decorator';
import { GqlAuthGuard } from '../auth/gql-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UsersService } from './users.service';
import { User } from './models/user.model';
import { ChangePasswordInput } from './dto/change-password.input';
import { UpdateUserInput } from './dto/update-user.input';
import { Role } from './enums/role.enum';

@Resolver(() => User)
@UseGuards(GqlAuthGuard, RolesGuard)
export class UsersResolver {
  constructor(private usersService: UsersService) {}

  @Query(() => User)
  async me(@UserEntity() user: User): Promise<User> {
    return user;
  }

  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @Query(() => [User])
  async getUsers(@UserEntity() user: User): Promise<User[]> {
    return this.usersService.findAll(user);
  }

  @Mutation(() => User)
  async updateUser(
    @UserEntity() currentUser: User,
    @Args('userId', { nullable: true }) userId: string,
    @Args('data') newUserData: UpdateUserInput,
  ): Promise<User> {
    const targetUserId = userId || currentUser.id;
    return this.usersService.updateUser(targetUserId, newUserData, currentUser);
  }

  @Mutation(() => User)
  async changePassword(
    @UserEntity() user: User,
    @Args('data') changePassword: ChangePasswordInput,
  ): Promise<User> {
    return this.usersService.changePassword(
      user.id,
      user.password,
      changePassword,
    );
  }

  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @Mutation(() => Boolean)
  async deleteUser(
    @UserEntity() currentUser: User,
    @Args('userId') userId: string,
  ): Promise<boolean> {
    await this.usersService.deleteUser(userId, currentUser);
    return true;
  }
}
