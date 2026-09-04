import { Injectable } from '@nestjs/common';
import { ServerInfoDto } from './dto/server-info.dto';
@Injectable()
export class ServerService {
  private serverData: ServerInfoDto = {
    name: 'SamuraiWorld',
    ip: 'play.samuraiworld.ru',
    version: '1.21',
    mode: 'Ванильное выживание',
    status: 'online',
    description: 'Ванильный Minecraft с политической системой. Выбирай президента, открывай бизнес, принимай законы — прямо в игре.',
    politicalSystem: 'Демократическая республика',
  };
  getInfo(): ServerInfoDto {
    return { ...this.serverData };
  }
  updateStatus(status: 'online' | 'offline'): ServerInfoDto {
    this.serverData.status = status;
    return { ...this.serverData };
  }
  updateDescription(description: string): ServerInfoDto {
    this.serverData.description = description;
    return { ...this.serverData };
  }
}
