import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { SettlementService } from './settlement.service';

export interface MeetingClosedEvent {
  meetingId: string;
  tenantId: string;
  closedBy: string;
}

@Injectable()
export class MeetingSettlementListener {
  private readonly logger = new Logger(MeetingSettlementListener.name);

  constructor(private readonly settlementService: SettlementService) {}

  @OnEvent('meeting.closed')
  async handleMeetingClosed(event: MeetingClosedEvent): Promise<void> {
    const { meetingId, tenantId, closedBy } = event;
    try {
      const settlement = await this.settlementService.settleFromMeeting(
        meetingId,
        tenantId,
        closedBy,
      );
      this.logger.log(
        `Settlement completed for meeting ${meetingId}: round ${settlement.roundNumber}, ` +
          `${settlement.summary.totalPointsAwarded} points awarded`,
      );
    } catch (err) {
      this.logger.error(
        `Failed to settle meeting ${meetingId}: ${(err as Error).message}`,
        (err as Error).stack,
      );
    }
  }
}
