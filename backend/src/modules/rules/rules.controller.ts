import { Controller, Get, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiOkResponse, ApiParam } from '@nestjs/swagger';
import { RulesService } from './rules.service';
import { RuleSectionDto, RuleDto } from './dto/rule.dto';
@ApiTags('rules')
@Controller('rules')
export class RulesController {
  constructor(private readonly rulesService: RulesService) {}
  @Get()
  @ApiOperation({ summary: 'Получить все правила (плоский список для фронта)' })
  @ApiOkResponse({ type: [RuleDto] })
  findAll(): RuleDto[] {
    return this.rulesService.findAllFlat();
  }
  @Get('sections')
  @ApiOperation({ summary: 'Получить правила по разделам (структурированный вид)' })
  @ApiOkResponse({ type: [RuleSectionDto] })
  findAllSections(): RuleSectionDto[] {
    return this.rulesService.findAllSections();
  }
  @Get('section/:title')
  @ApiOperation({ summary: 'Получить раздел по названию' })
  @ApiOkResponse({ type: RuleSectionDto })
  @ApiParam({ name: 'title', example: 'Общение' })
  findByCategory(@Param('title') title: string): RuleSectionDto {
    return this.rulesService.findByCategory(title);
  }
}
