import 'reflect-metadata';
import {
  ObjectType,
  registerEnumType,
  HideField,
  Field,
} from '@nestjs/graphql';
import { Exclude } from 'class-transformer';
import { IsEmail } from 'class-validator';
import { BaseModel } from '../../common/models/base.model';
import { Role } from '@prisma/client';

registerEnumType(Role, {
  name: 'Role',
  description: 'User role',
});

@ObjectType()
export class User extends BaseModel {
  @Field()
  @IsEmail()
  email: string;

  @Field(() => String)
  name: string;

  @Field(() => Role)
  role: Role;

  @HideField() // To hide in GraphQL schema
  @Exclude() // To exclude during JSON serialization
  password: string;
}
