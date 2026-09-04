import { IsString, IsIn, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
export class UpdateServerStatusDto {
  @ApiProperty({ enum: ['online', 'offline'], description: 'Новый статус сервера' })
  @IsString()
  @IsIn(['online', 'offline'])
  status: 'online' | 'offline';
}
export class UpdateServerDescriptionDto {
  @ApiProperty({ description: 'Новое описание сервера' })
  @IsString()
  @IsNotEmpty()
  description: string;
}
