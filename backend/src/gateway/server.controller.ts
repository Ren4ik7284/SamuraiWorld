import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiOkResponse } from '@nestjs/swagger';
import { ServerStatusService } from '../microservices/server-status/server-status.service';
@ApiTags('server')
@Controller('info')
export class ServerController {
  constructor(private readonly statusService: ServerStatusService) {}
  @Get()
  @ApiOperation({ summary: 'Получить живую информацию о сервере (ping & status)' })
  @ApiOkResponse({ description: 'Статус сервера, версию и текущий онлайн' })
  async getInfo() {
    return this.statusService.getInfoResponse();
  }
  @Get('players')
  @ApiOperation({ summary: 'Получить список онлайн игроков с аватарками/скинами' })
  async getOnlinePlayers() {
    const status = await this.statusService.getServerStatus();
    return {
      onlineCount: status.playersOnline,
      maxCount: status.maxPlayers,
      players: status.players,
    };
  }
}
