import { Controller, Get, Patch, Body } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiOkResponse } from '@nestjs/swagger';
import { ServerService } from './server.service';
import { ServerInfoDto } from './dto/server-info.dto';
import { UpdateServerStatusDto, UpdateServerDescriptionDto } from './dto/update-server.dto';
@ApiTags('server')
@Controller('info')
export class ServerController {
  constructor(private readonly serverService: ServerService) {}
  @Get()
  @ApiOperation({ summary: 'Получить информацию о сервере' })
  @ApiOkResponse({ type: ServerInfoDto })
  getInfo(): ServerInfoDto {
    return this.serverService.getInfo();
  }
  @Patch('status')
  @ApiOperation({ summary: 'Обновить статус сервера (admin)' })
  @ApiOkResponse({ type: ServerInfoDto })
  updateStatus(@Body() dto: UpdateServerStatusDto): ServerInfoDto {
    return this.serverService.updateStatus(dto.status);
  }
  @Patch('description')
  @ApiOperation({ summary: 'Обновить описание сервера (admin)' })
  @ApiOkResponse({ type: ServerInfoDto })
  updateDescription(@Body() dto: UpdateServerDescriptionDto): ServerInfoDto {
    return this.serverService.updateDescription(dto.description);
  }
}
