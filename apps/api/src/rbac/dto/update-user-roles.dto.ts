import { IsArray, IsString, ArrayMinSize } from 'class-validator';

export class UpdateUserRolesDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  roleCodes!: string[];
}
