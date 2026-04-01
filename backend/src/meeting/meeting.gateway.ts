import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { MeetingService, CastVoteDto, ContributionEntry } from './meeting.service';

interface AuthSocket extends Socket {
  userId: string;
  tenantId: string;
}

@WebSocketGateway({ namespace: '/meeting', cors: { origin: '*' } })
export class MeetingGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  private readonly server!: Server;

  private readonly logger = new Logger(MeetingGateway.name);

  // roomId → Set<userId>
  private readonly roomParticipants = new Map<string, Set<string>>();

  constructor(
    private readonly meetingService: MeetingService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async handleConnection(client: Socket): Promise<void> {
    const token = client.handshake.auth?.token as string | undefined;
    if (!token) {
      this.logger.warn(`Client ${client.id} disconnected: no token`);
      client.disconnect();
      return;
    }

    try {
      const secret =
        this.configService.get<string>('auth.jwtSecret') ??
        this.configService.get<string>('JWT_SECRET') ??
        'dev-secret';

      const payload = this.jwtService.verify<{ sub: string; tenantId: string }>(
        token,
        { secret },
      );
      (client as AuthSocket).userId = payload.sub;
      (client as AuthSocket).tenantId = payload.tenantId;
      this.logger.log(`Client connected: ${client.id} user=${payload.sub}`);
    } catch {
      this.logger.warn(`Client ${client.id} disconnected: invalid token`);
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket): void {
    const authClient = client as AuthSocket;
    this.logger.log(`Client disconnected: ${client.id}`);

    // 从所有 room 中移除该用户
    for (const [roomId, participants] of this.roomParticipants.entries()) {
      if (participants.has(authClient.userId)) {
        participants.delete(authClient.userId);
        const meetingId = roomId.replace('meeting:', '');
        this.server.to(roomId).emit('meeting:participants', {
          meetingId,
          count: participants.size,
        });
      }
    }
  }

  @SubscribeMessage('join')
  async handleJoin(
    @ConnectedSocket() client: AuthSocket,
    @MessageBody() data: { meetingId: string },
  ): Promise<void> {
    const roomId = `meeting:${data.meetingId}`;
    await client.join(roomId);

    if (!this.roomParticipants.has(roomId)) {
      this.roomParticipants.set(roomId, new Set());
    }
    this.roomParticipants.get(roomId)!.add(client.userId);

    const count = this.roomParticipants.get(roomId)!.size;
    this.server.to(roomId).emit('meeting:participants', {
      meetingId: data.meetingId,
      count,
    });
    this.logger.log(`User ${client.userId} joined meeting ${data.meetingId}`);
  }

  @SubscribeMessage('focus')
  handleFocus(
    @ConnectedSocket() client: AuthSocket,
    @MessageBody() data: { meetingId: string; taskId: string },
  ): void {
    const roomId = `meeting:${data.meetingId}`;
    this.server.to(roomId).emit('meeting:focus', {
      meetingId: data.meetingId,
      taskId: data.taskId,
      focusedBy: client.userId,
    });
  }

  @SubscribeMessage('vote')
  async handleVote(
    @ConnectedSocket() client: AuthSocket,
    @MessageBody() data: { meetingId: string; taskId: string } & CastVoteDto,
  ): Promise<void> {
    try {
      const stats = await this.meetingService.castVote({
        meetingId: data.meetingId,
        taskId: data.taskId,
        userId: client.userId,
        tenantId: client.tenantId,
        dto: { isApproval: data.isApproval, score: data.score },
      });
      const roomId = `meeting:${data.meetingId}`;
      this.server.to(roomId).emit('meeting:stats', {
        meetingId: data.meetingId,
        ...stats,
      });
    } catch (err) {
      client.emit('meeting:error', {
        event: 'vote',
        message: err instanceof Error ? err.message : '投票失败',
      });
    }
  }

  @SubscribeMessage('contribution')
  async handleContribution(
    @ConnectedSocket() client: AuthSocket,
    @MessageBody() data: { meetingId: string; taskId: string; contributions: ContributionEntry[] },
  ): Promise<void> {
    try {
      await this.meetingService.setContributions({
        meetingId: data.meetingId,
        taskId: data.taskId,
        tenantId: client.tenantId,
        contributions: data.contributions,
      });
      const roomId = `meeting:${data.meetingId}`;
      this.server.to(roomId).emit('meeting:contribution', {
        meetingId: data.meetingId,
        taskId: data.taskId,
        contributions: data.contributions,
        setBy: client.userId,
      });
    } catch (err) {
      client.emit('meeting:error', {
        event: 'contribution',
        message: err instanceof Error ? err.message : '设置贡献失败',
      });
    }
  }

  @SubscribeMessage('confirm')
  async handleConfirm(
    @ConnectedSocket() client: AuthSocket,
    @MessageBody() data: { meetingId: string; taskId: string; aiTotalScore: number },
  ): Promise<void> {
    try {
      const result = await this.meetingService.confirmTask({
        meetingId: data.meetingId,
        taskId: data.taskId,
        tenantId: client.tenantId,
        aiTotalScore: data.aiTotalScore,
      });
      const roomId = `meeting:${data.meetingId}`;
      this.server.to(roomId).emit('meeting:confirmed', {
        meetingId: data.meetingId,
        taskId: data.taskId,
        result,
        confirmedBy: client.userId,
      });
    } catch (err) {
      client.emit('meeting:error', {
        event: 'confirm',
        message: err instanceof Error ? err.message : '确认任务失败',
      });
    }
  }

  @SubscribeMessage('end')
  async handleEnd(
    @ConnectedSocket() client: AuthSocket,
    @MessageBody() data: { meetingId: string },
  ): Promise<void> {
    try {
      await this.meetingService.closeMeeting({
        meetingId: data.meetingId,
        tenantId: client.tenantId,
        closedBy: client.userId,
      });
      const roomId = `meeting:${data.meetingId}`;
      this.server.to(roomId).emit('meeting:ended', {
        meetingId: data.meetingId,
        endedBy: client.userId,
        endedAt: new Date().toISOString(),
      });
    } catch (err) {
      client.emit('meeting:error', {
        event: 'end',
        message: err instanceof Error ? err.message : '关闭会议失败',
      });
    }
  }
}
