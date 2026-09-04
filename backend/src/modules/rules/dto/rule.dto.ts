import { ApiProperty } from '@nestjs/swagger';
export class RuleDto {
  @ApiProperty({ example: 1 })
  id: number;
  @ApiProperty({ example: 'Общение' })
  category: string;
  @ApiProperty({ example: 'Уважайте других игроков' })
  title: string;
  @ApiProperty({ example: 'Запрещены оскорбления, травля, провокации...' })
  description: string;
  @ApiProperty({ example: ['оскорбления', 'травля'], required: false, type: [String] })
  bullets?: string[];
}
export class RuleSectionDto {
  @ApiProperty({ example: '1' })
  num: string;
  @ApiProperty({ example: 'Общение' })
  title: string;
  @ApiProperty({ type: [RuleDto] })
  items: RuleDto[];
}
