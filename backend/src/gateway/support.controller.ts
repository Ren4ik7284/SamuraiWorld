import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery, ApiBearerAuth } from '@nestjs/swagger';
import {
  SupportService,
  CreateTicketDto,
  AddMessageDto,
  TicketStatus,
} from '../microservices/support/support.service';
import { OptionalJwtAuthGuard, JwtAuthGuard, AuthenticatedRequest } from '../modules/auth/jwt-auth.guard';
@ApiTags('support')
@Controller('support')
export class SupportController {
  constructor(private readonly supportService: SupportService) {}
  @Post('tickets')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Создать обращение в техподдержку с привязкой к JWT пользователю' })
  createTicket(@Body() dto: CreateTicketDto, @Req() req: AuthenticatedRequest) {
    return this.supportService.createTicket(dto, req.user);
  }
  @Get('tickets')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Получить список тикетов (Обычный пользователь видит свои, Support/Admin — все)' })
  @ApiQuery({ name: 'nickname', required: false, description: 'Фильтр по нику игрока' })
  @ApiQuery({ name: 'category', required: false, description: 'Фильтр по категории' })
  @ApiQuery({ name: 'status', required: false, description: 'Фильтр по статусу' })
  getTickets(
    @Req() req: AuthenticatedRequest,
    @Query('nickname') nickname?: string,
    @Query('category') category?: string,
    @Query('status') status?: string,
  ) {
    return this.supportService.getTickets(req.user, { nickname, category, status });
  }
  @Get('tickets/:id')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Получить тикет и историю переписки по ID или номеру тикета' })
  getTicketById(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.supportService.getTicketById(id, req.user);
  }
  @Post('tickets/:id/messages')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Отправить сообщение/ответ в тикет' })
  addMessage(
    @Param('id') id: string,
    @Body() dto: AddMessageDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.supportService.addMessage(id, dto, req.user);
  }
  @Patch('tickets/:id/status')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Изменить статус тикета' })
  updateStatus(
    @Param('id') id: string,
    @Body('status') status: TicketStatus,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.supportService.updateStatus(id, status, req.user);
  }
  @Delete('tickets/:id')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Удалить тикет по ID' })
  deleteTicket(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.supportService.deleteTicket(id, req.user);
  }
}
