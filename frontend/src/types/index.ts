export interface ScheduleActivity {
  id?: number;
  activity_id: string;
  wbs: string;
  discipline: string;
  description: string;
  planned_start?: string;
  planned_finish?: string;
  location?: string;
  status: string;
  created_at?: string;
}

export interface ProgressEvent {
  id?: number;
  event_id: string;
  source_document?: string;
  discipline?: string;
  raw_text?: string;
  normalized_description?: string;
  event_type: string;
  location?: string;
  date?: string;
  actual_start?: string;
  actual_finish?: string;
  activity_id?: string;
  confidence?: number;
  status: string;
  created_at?: string;
}

export interface ReviewItem {
  id?: number;
  review_id: string;
  event_id: string;
  match_id?: string;
  event_description?: string;
  activity_description?: string;
  activity_id?: string;
  confidence: number;
  status: string;
  reviewer_notes?: string;
  alternative_activity_id?: string;
  alternative_activity_desc?: string;
  alternative_confidence?: number;
  is_ambiguous?: boolean;
  created_at?: string;
  explanation?: string;
  description_similarity?: number;
  discipline_similarity?: number;
  token_similarity?: number;
  location_similarity?: number;
  date_compatibility?: number;
}

export interface AuditLog {
  id?: number;
  audit_id: string;
  action: string;
  entity_type: string;
  entity_id?: string;
  details?: string;
  user: string;
  timestamp: string;
}

export interface PlannedVsActualItem {
  activity_id: string;
  description: string;
  discipline: string;
  planned_start?: string;
  planned_finish?: string;
  actual_start?: string;
  actual_finish?: string;
  schedule_status?: string;
  status?: string;
  variance?: string;
  variance_days?: number;
  linked_events_count?: number;
}

export interface DashboardData {
  total_activities: number;
  total_events: number;
  matched_events: number;
  avg_confidence: number;
  review_queue_count: number;
  unmatched_count: number;
  discipline_progress: {
    discipline: string;
    total_activities: number;
    matched_events: number;
    total_events: number;
    progress_pct: number;
  }[];
  confidence_distribution: {
    range: string;
    count: number;
  }[];
  recent_audits: AuditLog[];
  planned_vs_actual: PlannedVsActualItem[];
}

export interface DraftProgressEvent {
  draft_id: string;
  discipline: string;
  raw_text: string;
  normalized_description: string;
  event_type: string;
  location?: string;
  actual_start?: string;
  actual_finish?: string;
  date: string;
}

export interface CandidateMatch {
  activity_id: string;
  wbs?: string;
  discipline: string;
  description: string;
  location?: string;
  planned_start?: string;
  planned_finish?: string;
  similarity_score: number;
  confidence_score: number;
  description_similarity: number;
  discipline_similarity: number;
  token_similarity: number;
  location_similarity: number;
  date_compatibility: number;
  explanation: string;
}

export interface LogProgressResponse {
  intent?: 'greeting' | 'capability' | 'project_query' | 'field_progress' | 'unclear';
  message?: string;
  extracted_event?: DraftProgressEvent;
  top_candidate?: CandidateMatch;
  candidates: CandidateMatch[];
  confidence_category: 'high' | 'review' | 'unmatched' | 'conversational';
  recommended_action: string;
}

export interface ConfirmProgressRequest {
  draft_id: string;
  raw_text: string;
  normalized_description: string;
  discipline: string;
  event_type: string;
  location?: string;
  actual_start?: string;
  actual_finish?: string;
  activity_id?: string;
  confidence: number;
  reviewer_notes?: string;
}
