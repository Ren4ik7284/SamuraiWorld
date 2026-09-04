import { Controller, Get, Post, Body, Param } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { ContentService } from '../microservices/content/content.service';
import { CreateNewsDto } from '../modules/news/dto/create-news.dto';
@ApiTags('content')
@Controller()
export class ContentController {
  constructor(private readonly contentService: ContentService) {}
  @Get('rules')
  @ApiOperation({ summary: 'Получить статьи Конституции и правила сервера' })
  getRules() {
    return this.contentService.getRules();
  }
  @Get('news')
  @ApiOperation({ summary: 'Получить список всех новостей и анонсов' })
  getNews() {
    return this.contentService.getNews();
  }
  @Get('news/:id')
  @ApiOperation({ summary: 'Получить новость по ID' })
  getNewsById(@Param('id') id: string) {
    return this.contentService.getNewsById(id);
  }
  @Post('news')
  @ApiOperation({ summary: 'Опубликовать новость (admin)' })
  createNews(@Body() dto: CreateNewsDto) {
    return this.contentService.createNews(dto);
  }
}
