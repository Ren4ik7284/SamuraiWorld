import { Controller, Get, Post, Delete, Body, Param, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiOkResponse, ApiCreatedResponse, ApiNoContentResponse, ApiParam } from '@nestjs/swagger';
import { NewsService } from './news.service';
import { NewsItemDto } from './dto/news-item.dto';
import { CreateNewsDto } from './dto/create-news.dto';
@ApiTags('news')
@Controller('news')
export class NewsController {
  constructor(private readonly newsService: NewsService) {}
  @Get()
  @ApiOperation({ summary: 'Получить список всех новостей' })
  @ApiOkResponse({ type: [NewsItemDto] })
  findAll(): NewsItemDto[] {
    return this.newsService.findAll();
  }
  @Get(':id')
  @ApiOperation({ summary: 'Получить одну новость по ID' })
  @ApiOkResponse({ type: NewsItemDto })
  @ApiParam({ name: 'id', description: 'UUID новости' })
  findOne(@Param('id') id: string): NewsItemDto {
    return this.newsService.findOne(id);
  }
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Создать новость (admin)' })
  @ApiCreatedResponse({ type: NewsItemDto })
  create(@Body() dto: CreateNewsDto): NewsItemDto {
    return this.newsService.create(dto);
  }
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Удалить новость по ID (admin)' })
  @ApiNoContentResponse({ description: 'Удалено успешно' })
  @ApiParam({ name: 'id', description: 'UUID новости' })
  remove(@Param('id') id: string): void {
    this.newsService.remove(id);
  }
}
