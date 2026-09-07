import { Injectable, Logger } from '@nestjs/common';
import * as net from 'net';
export interface RconResult {
  driver: string;
  success: boolean;
  message?: string;
  output?: string[];
  error?: string;
}
export interface GrantVipResponse {
  nickname: string;
  executedAt: string;
  driversExecuted: number;
  results: RconResult[];
}
export interface GrantVipOptions {
  commands?: string[];
  pteroUrl?: string;
  pteroKey?: string;
  pteroServerId?: string;
  rconHost?: string;
  rconPort?: number;
  rconPassword?: string;
}
@Injectable()
export class McExecutorService {
  private readonly logger = new Logger(McExecutorService.name);
  async sendRconCommand(host: string, port: number, password: string, command: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const socket = new net.Socket();
      let authenticated = false;
      let responseData = '';
      const reqId = Math.floor(Math.random() * 100000) + 1;
      socket.setTimeout(4000);
      socket.on('connect', () => {
        this.sendPacket(socket, reqId, 3, password);
      });
      socket.on('data', (data: Buffer) => {
        let offset = 0;
        while (offset < data.length) {
          if (data.length - offset < 12) break;
          const length = data.readInt32LE(offset);
          const id = data.readInt32LE(offset + 4);
          const type = data.readInt32LE(offset + 8);
          const body = data.toString('utf8', offset + 12, offset + 4 + length - 2);
          offset += 4 + length;
          if (!authenticated) {
            if (id === -1) {
              socket.destroy();
              return reject(new Error('RCON Authentication Failed (неверный пароль RCON)'));
            }
            if (type === 2 || type === 0) {
              authenticated = true;
              this.sendPacket(socket, reqId + 1, 2, command);
            }
          } else {
            responseData += body;
            socket.end();
          }
        }
      });
      socket.on('end', () => resolve(responseData.trim()));
      socket.on('timeout', () => {
        socket.destroy();
        reject(new Error(`RCON timeout (${host}:${port})`));
      });
      socket.on('error', (err: Error) => reject(new Error(`RCON network error: ${err.message}`)));
      socket.connect(port, host);
    });
  }
  private sendPacket(socket: net.Socket, id: number, type: number, body: string): void {
    const bodyBuf = Buffer.from(body, 'utf8');
    const length = 4 + 4 + bodyBuf.length + 2;
    const buffer = Buffer.alloc(4 + length);
    buffer.writeInt32LE(length, 0);
    buffer.writeInt32LE(id, 4);
    buffer.writeInt32LE(type, 8);
    bodyBuf.copy(buffer, 12);
    buffer.writeInt8(0, 12 + bodyBuf.length);
    buffer.writeInt8(0, 12 + bodyBuf.length + 1);
    socket.write(buffer);
  }
  async sendPterodactylCommand(panelUrl: string, apiKey: string, serverId: string, command: string): Promise<boolean> {
    const cleanUrl = panelUrl.replace(/\/+$/, '');
    const url = `${cleanUrl}/api/client/servers/${serverId}/command`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ command }),
    });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Pterodactyl API error (${response.status}): ${text}`);
    }
    return true;
  }
  async grantPassInMinecraft(nickname: string, options: GrantVipOptions = {}): Promise<GrantVipResponse> {
    const nick = nickname.trim();
    const passCommands = options.commands || [
      `swl add ${nick}`,
      `simplewhitelist add ${nick}`,
      `whitelist add ${nick}`,
      `lp user ${nick} parent set member`,
      `luckperms user ${nick} parent set member`,
      `lp user ${nick} parent add member`,
      `luckperms user ${nick} parent add member`,
      `manuadd ${nick} member`,
      `say [SamuraiWorld] Igrok ${nick} poluchil Prohodku na server!`,
      `title ${nick} title {"text":"PROHODKA AKTIVIROVANA!","color":"aqua"}`,
    ];
    return this.grantVipInMinecraft(nick, { ...options, commands: passCommands });
  }
  async grantVipInMinecraft(nickname: string, options: GrantVipOptions = {}): Promise<GrantVipResponse> {
    const nick = nickname.trim();
    const results: RconResult[] = [];
    const commands = options.commands || [
      `lp user ${nick} parent set vip`,
      `luckperms user ${nick} parent set vip`,
      `lp user ${nick} parent add vip`,
      `luckperms user ${nick} parent add vip`,
      `manuadd ${nick} vip`,
      `say [SamuraiWorld] Igrok ${nick} poluchil VIP status! Spasibo za podderzhku!`,
      `title ${nick} title {"text":"VIP AKTIVIROVAN!","color":"gold"}`,
    ];
    const pteroUrl = options.pteroUrl || process.env.PTERODACTYL_URL || 'https://qwertyx.host';
    const pteroKey = options.pteroKey || process.env.PTERODACTYL_API_KEY || '';
    const pteroServerId = options.pteroServerId || process.env.PTERODACTYL_SERVER_ID || '';
    if (pteroKey && pteroServerId) {
      try {
        for (const cmd of commands) {
          await this.sendPterodactylCommand(pteroUrl, pteroKey, pteroServerId, cmd);
        }
        results.push({
          driver: 'Pterodactyl API (qwertyx.host)',
          success: true,
          message: `Privilege granted to ${nick} via panel console`,
        });
      } catch (err: any) {
        this.logger.warn(`[Pterodactyl] dispatch failed: ${err.message}`);
        results.push({
          driver: 'Pterodactyl API (qwertyx.host)',
          success: false,
          error: err.message,
        });
      }
    }
    const rconPassword = options.rconPassword || process.env.MINECRAFT_RCON_PASSWORD;
    if (!rconPassword) {
      results.push({
        driver: 'RCON',
        success: false,
        error: 'MINECRAFT_RCON_PASSWORD не задан в .env — RCON отключён из соображений безопасности',
      });
      return { nickname: nick, executedAt: new Date().toISOString(), driversExecuted: results.length, results };
    }
    const hostsToTry: string[] = [];
    if (options.rconHost) hostsToTry.push(options.rconHost);
    if (process.env.MINECRAFT_RCON_HOST) hostsToTry.push(process.env.MINECRAFT_RCON_HOST);
    hostsToTry.push('qwertyx.host', 'host.docker.internal', '172.17.0.1', '127.0.0.1');
    const uniqueHosts = Array.from(new Set(hostsToTry));
    const portsToTry = options.rconPort ? [Number(options.rconPort)] : [25575, 26687];
    let rconSuccess = false;
    for (const host of uniqueHosts) {
      if (rconSuccess) break;
      for (const port of portsToTry) {
        try {
          const outputs: string[] = [];
          for (const cmd of commands) {
            const out = await this.sendRconCommand(host, port, rconPassword, cmd);
            outputs.push(out);
          }
          results.push({
            driver: `RCON (${host}:${port})`,
            success: true,
            message: `Privilege granted to ${nick} via RCON`,
            output: outputs,
          });
          rconSuccess = true;
          break;
        } catch (err: any) {
          results.push({
            driver: `RCON (${host}:${port})`,
            success: false,
            error: err.message,
          });
        }
      }
    }
    return {
      nickname: nick,
      executedAt: new Date().toISOString(),
      driversExecuted: results.length,
      results,
    };
  }
}
