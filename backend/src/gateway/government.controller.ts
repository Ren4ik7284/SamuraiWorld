import { Controller, Get, Param } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { GovernmentService } from '../microservices/government/government.service';
@ApiTags('government')
@Controller('government')
export class GovernmentController {
  constructor(private readonly governmentService: GovernmentService) {}
  @Get('citizens')
  @ApiOperation({ summary: 'Реестр всех зарегистрированных граждан сервера' })
  getCitizens() {
    return this.governmentService.getCitizens();
  }
  @Get('citizens/:username')
  @ApiOperation({ summary: 'Получить игровой паспорт гражданина по нику' })
  getCitizenByUsername(@Param('username') username: string) {
    return this.governmentService.getCitizenByUsername(username);
  }
  @Get('laws')
  @ApiOperation({ summary: 'Реестр действующих законов и кодексов сервера' })
  getLaws() {
    return this.governmentService.getLaws();
  }
  @Get('parties')
  @ApiOperation({ summary: 'Список политических партий сервера' })
  getParties() {
    return this.governmentService.getParties();
  }
  @Get('elections')
  @ApiOperation({ summary: 'Информация о текущих президентских выборах' })
  getElections() {
    return this.governmentService.getElections();
  }
}
