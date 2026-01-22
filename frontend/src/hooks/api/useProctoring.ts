import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { proctoringService, type CreateSessionDto, type StartSessionDto, type RecordEventDto } from '@/services/proctoring';

const QUERY_KEYS = {
  logs: (assessmentId: string, userId: string) => ['proctoring', 'logs', assessmentId, userId] as const,
  summary: (assessmentId: string, userId: string) => ['proctoring', 'summary', assessmentId, userId] as const,
  snapshot: (snapshotId: string) => ['proctoring', 'snapshot', snapshotId] as const,
};

export const useCreateProctoringSession = () => {
  return useMutation({
    mutationFn: (data: CreateSessionDto) => proctoringService.createSession(data),
  });
};

export const useStartProctoringSession = () => {
  return useMutation({
    mutationFn: (data: StartSessionDto) => proctoringService.startSession(data),
  });
};

export const useStopProctoringSession = () => {
  return useMutation({
    mutationFn: (sessionId: string) => proctoringService.stopSession(sessionId),
  });
};

export const useRecordProctoringEvent = () => {
  return useMutation({
    mutationFn: (data: RecordEventDto) => proctoringService.recordEvent(data),
  });
};

export const useProctoringLogs = (assessmentId: string | undefined, userId: string | undefined) => {
  return useQuery({
    queryKey: QUERY_KEYS.logs(assessmentId || '', userId || ''),
    queryFn: async () => {
      if (!assessmentId || !userId) throw new Error('Assessment ID and User ID are required');
      const response = await proctoringService.getLogs(assessmentId, userId);
      return response.data;
    },
    enabled: !!assessmentId && !!userId,
    staleTime: 1 * 60 * 1000, // 1 minute (logs change frequently)
  });
};

export const useProctoringSummary = (assessmentId: string | undefined, userId: string | undefined) => {
  return useQuery({
    queryKey: QUERY_KEYS.summary(assessmentId || '', userId || ''),
    queryFn: async () => {
      if (!assessmentId || !userId) throw new Error('Assessment ID and User ID are required');
      const response = await proctoringService.getSummary(assessmentId, userId);
      return response.data;
    },
    enabled: !!assessmentId && !!userId,
    staleTime: 1 * 60 * 1000, // 1 minute
  });
};

export const useProctoringSnapshot = (snapshotId: string | undefined) => {
  return useQuery({
    queryKey: QUERY_KEYS.snapshot(snapshotId || ''),
    queryFn: async () => {
      if (!snapshotId) throw new Error('Snapshot ID is required');
      const response = await proctoringService.getSnapshot(snapshotId);
      return response.data;
    },
    enabled: !!snapshotId,
    staleTime: 5 * 60 * 1000, // 5 minutes (snapshots don't change)
  });
};

export const useUploadProctoringSnapshot = () => {
  return useMutation({
    mutationFn: ({ file, assessmentId, userId, sessionId, metadata }: {
      file: File;
      assessmentId: string;
      userId: string;
      sessionId: string;
      metadata: string;
    }) => proctoringService.uploadSnapshot(file, assessmentId, userId, sessionId, metadata),
  });
};




