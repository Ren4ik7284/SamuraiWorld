import { ApiProperty } from '@nestjs/swagger';
export class NewsItemDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  id: string;
  @ApiProperty({ example: 'SamuraiWorld открыт!' })
  title: string;
  @ApiProperty({ example: 'Сервер запущен. Мир чист, ресурсы нетронуты.' })
  content: string;
  @ApiProperty({ example: '2025-08-01' })
  date: string;
  @ApiProperty({ example: 'Открытие', description: 'Тег/категория новости' })
  tag: string;
}
