import { DashboardData, ScheduleActivity, ProgressEvent, ReviewItem, AuditLog } from '../types';

const BASE_URL = (import.meta as any).env?.VITE_API_URL || '';

async function request<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const url = `${BASE_URL}${endpoint}`;
  const response = await fetch(url, options);
  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`API Error ${response.status}: ${errorBody || response.statusText}`);
  }
  return response.json();
}

export const api = {
  // Health
  getHealth: () => request<{ status: string; service: string; mode: string; ai_provider: string }>('/health'),

  // Dashboard
  getDashboard: () => request<DashboardData>('/api/v1/dashboard'),

  // Schedule
  uploadSchedule: (formData: FormData) =>
    request<{ message: string; document_id: string; activities_imported: number }>('/api/v1/schedule/upload', {
      method: 'POST',
      body: formData,
    }),
  getActivities: (discipline?: string) => {
    const query = discipline ? `?discipline=${encodeURIComponent(discipline)}` : '';
    return request<{ activities: ScheduleActivity[]; count: number }>(`/api/v1/schedule/activities${query}`);
  },

  // Progress
  uploadProgress: (formData: FormData) =>
    request<{ message: string; document_id: string; events_extracted: number }>('/api/v1/progress/upload', {
      method: 'POST',
      body: formData,
    }),
  parseProgress: (formData: FormData) =>
    request<{ events: ProgressEvent[]; count: number; source: string }>('/api/v1/progress/parse', {
      method: 'POST',
      body: formData,
    }),
  getProgressEvents: (status?: string, discipline?: string) => {
    const params = new URLSearchParams();
    if (status) params.append('status', status);
    if (discipline) params.append('discipline', discipline);
    const query = params.toString() ? `?${params.toString()}` : '';
    return request<{ events: ProgressEvent[]; count: number }>(`/api/v1/progress${query}`);
  },

  // Matching
  runMatching: () =>
    request<{ message: string; total_events: number; auto_matched: number; review_required: number; unmatched: number }>(
      '/api/v1/matching/run',
      { method: 'POST' }
    ),
  getReviewQueue: () => request<{ review_items: ReviewItem[]; count: number }>('/api/v1/matching/review'),
  approveMatch: (matchId: string, notes?: string, chosenActivityId?: string) =>
    request<{ message: string; match_id: string }>(`/api/v1/matching/${matchId}/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'approve', reviewer_notes: notes, chosen_activity_id: chosenActivityId }),
    }),
  rejectMatch: (matchId: string, notes?: string) =>
    request<{ message: string; match_id: string }>(`/api/v1/matching/${matchId}/reject`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'reject', reviewer_notes: notes }),
    }),

  // Audit
  getAudit: (limit = 50) => request<{ audit_logs: AuditLog[]; count: number }>(`/api/v1/audit?limit=${limit}`),

  // AI Agent & Memory
  queryAgent: (query: string) =>
    request<{
      query: string;
      answer: string;
      relevant_activities: ScheduleActivity[];
      relevant_events: ProgressEvent[];
      confidence_level: string;
    }>('/api/v1/agent/query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
    }),
  logProgress: (message: string, date?: string) =>
    request<import('../types').LogProgressResponse>('/api/v1/agent/log-progress', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, date }),
    }),
  confirmProgress: (payload: import('../types').ConfirmProgressRequest) =>
    request<{
      message: string;
      event_id: string;
      activity_id?: string;
      status: string;
      confidence: number;
    }>('/api/v1/agent/confirm-progress', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }),
  getMemory: () =>
    request<{
      stats: {
        total_matches_evaluated: number;
        auto_matches: number;
        human_approved: number;
        human_rejected: number;
        mean_confidence: number;
      };
      terminology_lexicon: { alias: string; canonical: string }[];
      historical_learned_links: any[];
    }>('/api/v1/memory'),
};
