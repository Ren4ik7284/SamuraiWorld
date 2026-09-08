import { Controller, Get, Post, Body, Param, UseGuards, Req, ForbiddenException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ContentService } from '../microservices/content/content.service';
import { CreateNewsDto } from '../modules/news/dto/create-news.dto';
import { JwtAuthGuard, AuthenticatedRequest } from '../modules/auth/jwt-auth.guard';
import { getMasterAdmins } from '../modules/auth/auth.service';

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
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Опубликовать новость (только Admin)' })
  createNews(@Body() dto: CreateNewsDto, @Req() req: AuthenticatedRequest) {
    const user = req.user;
    const isMaster = user && getMasterAdmins().includes(user.nickname?.toLowerCase());
    if (!user || (!isMaster && user.role !== 'admin')) {
      throw new ForbiddenException('Публикация новостей разрешена только администраторам');
    }
    return this.contentService.createNews(dto);
  }
}
