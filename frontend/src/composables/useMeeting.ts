import { ref, onUnmounted } from 'vue';
import { io, Socket } from 'socket.io-client';
import { useAuthStore } from '@/stores/auth';

export interface TaskVoteStats {
  approvalCount: number;
  challengeCount: number;
  medianScore: number | null;
  voteCount: number;
}

export interface ContributionEntry {
  userId: string;
  percentage: number;
}

export interface MeetingTaskResult {
  finalScore: number;
  voteCount: number;
  approvalCount: number;
  challengeCount: number;
  medianScore: number;
}

export function useMeeting(meetingId: string) {
  const authStore = useAuthStore();

  const socket = ref<Socket | null>(null);
  const isConnected = ref(false);
  const focusedTaskId = ref<string | null>(null);
  const participants = ref(0);
  const taskStats = ref(new Map<string, TaskVoteStats>());
  const confirmedTasks = ref(new Set<string>());
  const confirmedResults = ref(new Map<string, MeetingTaskResult>());
  const meetingEnded = ref(false);

  function connect(): void {
    if (socket.value?.connected) return;

    const s = io('/meeting', {
      auth: { token: authStore.accessToken },
      transports: ['websocket'],
    });

    socket.value = s;

    s.on('connect', () => {
      isConnected.value = true;
      emitJoin();
    });

    s.on('disconnect', () => {
      isConnected.value = false;
    });

    s.on('meeting:focus', (data: { meetingId: string; taskId: string }) => {
      if (data.meetingId === meetingId) {
        focusedTaskId.value = data.taskId;
      }
    });

    s.on('meeting:stats', (data: { meetingId: string; taskId: string } & TaskVoteStats) => {
      if (data.meetingId === meetingId) {
        taskStats.value.set(data.taskId, {
          approvalCount: data.approvalCount,
          challengeCount: data.challengeCount,
          medianScore: data.medianScore,
          voteCount: data.voteCount,
        });
      }
    });

    s.on('meeting:confirmed', (data: { meetingId: string; taskId: string; result: MeetingTaskResult }) => {
      if (data.meetingId === meetingId) {
        confirmedTasks.value.add(data.taskId);
        confirmedResults.value.set(data.taskId, data.result);
      }
    });

    s.on('meeting:ended', (data: { meetingId: string }) => {
      if (data.meetingId === meetingId) {
        meetingEnded.value = true;
      }
    });

    s.on('meeting:participants', (data: { meetingId: string; count: number }) => {
      if (data.meetingId === meetingId) {
        participants.value = data.count;
      }
    });
  }

  function disconnect(): void {
    socket.value?.disconnect();
    socket.value = null;
    isConnected.value = false;
  }

  function emitJoin(): void {
    socket.value?.emit('join', { meetingId });
  }

  function emitFocus(taskId: string): void {
    socket.value?.emit('focus', { meetingId, taskId });
  }

  function emitVote(opts: { taskId: string; isApproval: boolean; score?: number }): void {
    socket.value?.emit('vote', { meetingId, ...opts });
  }

  function emitContribution(opts: { taskId: string; contributions: ContributionEntry[] }): void {
    socket.value?.emit('contribution', { meetingId, ...opts });
  }

  function emitConfirm(opts: { taskId: string; aiTotalScore: number }): void {
    socket.value?.emit('confirm', { meetingId, ...opts });
  }

  function emitEnd(): void {
    socket.value?.emit('end', { meetingId });
  }

  onUnmounted(() => {
    disconnect();
  });

  return {
    socket,
    isConnected,
    focusedTaskId,
    participants,
    taskStats,
    confirmedTasks,
    confirmedResults,
    meetingEnded,
    connect,
    disconnect,
    emitJoin,
    emitFocus,
    emitVote,
    emitContribution,
    emitConfirm,
    emitEnd,
  };
}
