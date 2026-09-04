import { ApiProperty } from '@nestjs/swagger';
export class ServerInfoDto {
  @ApiProperty({ example: 'SamuraiWorld', description: 'Название сервера' })
  name: string;
  @ApiProperty({ example: 'play.samuraiworld.ru', description: 'IP адрес сервера' })
  ip: string;
  @ApiProperty({ example: '1.21', description: 'Версия Minecraft' })
  version: string;
  @ApiProperty({ example: 'Ванильное выживание', description: 'Режим игры' })
  mode: string;
  @ApiProperty({ example: 'online', enum: ['online', 'offline'], description: 'Статус сервера' })
  status: 'online' | 'offline';
  @ApiProperty({ example: 'Политический выживач — выбирай президента, строй бизнес, принимай законы' })
  description: string;
  @ApiProperty({ example: 'Демократическая республика', description: 'Тип политической системы' })
  politicalSystem: string;
}
