import { InputType, Field } from '@nestjs/graphql';
import { Role } from '@prisma/client';
import { IsOptional, IsEnum } from 'class-validator';

@InputType()
export class UpdateUserInput {
  @Field({ nullable: true })
  name?: string;

  @Field(() => Role, { nullable: true })
  @IsOptional()
  @IsEnum(Role)
  role?: Role;
}
