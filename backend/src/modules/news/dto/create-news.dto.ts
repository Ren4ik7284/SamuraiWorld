import { IsString, IsNotEmpty, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
export class CreateNewsDto {
  @ApiProperty({ example: 'Первые выборы президента!', description: 'Заголовок новости' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  title: string;
  @ApiProperty({ example: 'Подробности о предстоящих выборах...', description: 'Текст новости' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  content: string;
  @ApiProperty({ example: 'Политика', description: 'Тег/категория' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(40)
  tag: string;
}
