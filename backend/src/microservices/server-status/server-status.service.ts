import { Injectable, Logger } from '@nestjs/common';
import { MinecraftPingService, LiveServerStatus } from './minecraft-ping.service';
@Injectable()
export class ServerStatusService {
  private readonly logger = new Logger(ServerStatusService.name);
  private cachedStatus: LiveServerStatus | null = null;
  private lastFetchTime = 0;
  private readonly cacheTtlMs = 15000; 
  constructor(private readonly pingService: MinecraftPingService) {}
  async getServerStatus(): Promise<LiveServerStatus> {
    const now = Date.now();
    if (this.cachedStatus && now - this.lastFetchTime < this.cacheTtlMs) {
      return this.cachedStatus;
    }
    this.logger.log('Кэш истек. Запрос актуального статуса Minecraft-сервера...');
    const status = await this.pingService.pingServer();
    this.cachedStatus = status;
    this.lastFetchTime = now;
    return status;
  }
  async getInfoResponse() {
    const status = await this.getServerStatus();
    return {
      name: 'SamuraiWorld',
      ip: status.ip,
      version: status.version,
      mode: 'Политический ванильный выживач',
      status: status.online ? 'online' : 'offline',
      description: status.motd,
      politicalSystem: 'Демократическая Республика',
      playersOnline: status.playersOnline,
      maxPlayers: status.maxPlayers,
      latencyMs: status.latencyMs,
      onlinePlayers: status.players,
    };
  }
}
