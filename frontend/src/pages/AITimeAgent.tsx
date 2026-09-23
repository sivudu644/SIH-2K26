import React, { useState } from 'react';
import {
  Bot,
  Send,
  Sparkles,
  CheckCircle2,
  XCircle,
  FilePlus,
  MessageSquare,
  Sliders,
  Check,
  Edit3,
} from 'lucide-react';
import { api } from '../api/client';
import { ScheduleActivity, ProgressEvent, LogProgressResponse, DraftProgressEvent, CandidateMatch } from '../types';
import { ConfidenceBadge } from '../components/ConfidenceBadge';
import { useToast } from '../components/ToastContext';

interface ChatMessage {
  id: string;
  sender: 'user' | 'agent';
  text: string;
  mode?: 'query' | 'log';
  activities?: ScheduleActivity[];
  events?: ProgressEvent[];
  logProposal?: LogProgressResponse;
  confirmedEventId?: string;
  isConfirmed?: boolean;
  isCancelled?: boolean;
}

export const AITimeAgent: React.FC = () => {
  const { addToast } = useToast();
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      sender: 'agent',
      text: 'Hello! I am your AI Time Agent for Infrastructure Project Controls. You can ask me questions about project status, delays, and schedule baseline, or switch to "Log Field Progress" to submit conversational execution updates.',
    },
  ]);
  const [inputQuery, setInputQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [activeMode, setActiveMode] = useState<'query' | 'log'>('log');
  const [editingDraftId, setEditingDraftId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<{
    discipline: string;
    description: string;
    location: string;
    actualStart: string;
    actualFinish: string;
    activityId: string;
    notes: string;
  }>({
    discipline: 'piping',
    description: '',
    location: '',
    actualStart: '',
    actualFinish: '',
    activityId: '',
    notes: '',
  });

  const handleSend = async (queryText?: string, forcedMode?: 'query' | 'log') => {
    const q = (queryText || inputQuery).trim();
    if (!q) return;

    const currentMode = forcedMode || activeMode;

    // Detect if message starts with logging keywords or is in log mode
    const isLogIntent =
      currentMode === 'log' ||
      /^(today we|completed|started|finished|installed|erected|poured|excavated|pulled|laid)\b/i.test(q);

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      sender: 'user',
      text: q,
      mode: isLogIntent ? 'log' : 'query',
    };
    setMessages((prev) => [...prev, userMsg]);
    setInputQuery('');
    setLoading(true);

    try {
      if (isLogIntent) {
        // Call log-progress endpoint
        const logRes = await api.logProgress(q);

        // Check if the backend classified this as a conversational intent (greeting / capability / unclear)
        if (
          logRes.confidence_category === 'conversational' ||
          logRes.intent === 'greeting' ||
          logRes.intent === 'capability' ||
          !logRes.extracted_event
        ) {
          const agentMsg: ChatMessage = {
            id: (Date.now() + 1).toString(),
            sender: 'agent',
            text: logRes.message || 'Hello! How can I assist with your project controls and field progress today?',
            mode: 'log',
          };
          setMessages((prev) => [...prev, agentMsg]);
        } else {
          // Real field progress extracted & matched
          const disc = logRes.extracted_event?.discipline ? logRes.extracted_event.discipline.toUpperCase() : 'GENERAL';
          const agentMsg: ChatMessage = {
            id: (Date.now() + 1).toString(),
            sender: 'agent',
            text: `Extracted draft execution event for discipline "${disc}". Evaluated against baseline schedule activities:`,
            mode: 'log',
            logProposal: logRes,
          };
          setMessages((prev) => [...prev, agentMsg]);
        }
      } else {
        // Call standard query endpoint
        const res = await api.queryAgent(q);
        const agentMsg: ChatMessage = {
          id: (Date.now() + 1).toString(),
          sender: 'agent',
          text: res.answer,
          mode: 'query',
          activities: res.relevant_activities,
          events: res.relevant_events,
        };
        setMessages((prev) => [...prev, agentMsg]);
      }
    } catch (err: any) {
      const errMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        sender: 'agent',
        text: `Error processing request: ${err.message}`,
      };
      setMessages((prev) => [...prev, errMsg]);
      addToast('error', `AI processing error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmProgress = async (msgId: string, proposal: LogProgressResponse) => {
    if (!proposal.extracted_event) return;
    try {
      setLoading(true);
      const draft = proposal.extracted_event;
      const topCand = proposal.top_candidate;

      const payload = {
        draft_id: draft.draft_id,
        raw_text: draft.raw_text,
        normalized_description: draft.normalized_description,
        discipline: draft.discipline,
        event_type: draft.event_type,
        location: draft.location,
        actual_start: draft.actual_start || undefined,
        actual_finish: draft.actual_finish || undefined,
        activity_id: topCand ? topCand.activity_id : undefined,
        confidence: topCand ? topCand.confidence_score : 0.0,
        reviewer_notes: 'Confirmed via AI Time Agent conversational interface',
      };

      const res = await api.confirmProgress(payload);

      setMessages((prev) =>
        prev.map((m) =>
          m.id === msgId
            ? { ...m, isConfirmed: true, confirmedEventId: res.event_id }
            : m
        )
      );

      const confirmMsg: ChatMessage = {
        id: Date.now().toString(),
        sender: 'agent',
        text: `Confirmed and committed! Progress event [${res.event_id.slice(0, 8)}] linked to Schedule Activity [${res.activity_id || 'UNLINKED'}] with status "${res.status.toUpperCase()}". Audit trail and dashboard updated.`,
      };
      setMessages((prev) => [...prev, confirmMsg]);
      addToast('success', `Progress event committed & linked to ${res.activity_id || 'Unlinked Activity'}!`);
    } catch (err: any) {
      addToast('error', `Confirmation failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleCancelProgress = (msgId: string) => {
    setMessages((prev) =>
      prev.map((m) => (m.id === msgId ? { ...m, isCancelled: true } : m))
    );
    addToast('info', 'Draft submission cancelled.');
  };

  const startEdit = (draft: DraftProgressEvent, topCand?: CandidateMatch) => {
    setEditingDraftId(draft.draft_id);
    setEditForm({
      discipline: draft.discipline,
      description: draft.normalized_description,
      location: draft.location || '',
      actualStart: draft.actual_start || '',
      actualFinish: draft.actual_finish || '',
      activityId: topCand?.activity_id || '',
      notes: '',
    });
  };

  const handleSaveEditAndConfirm = async (msgId: string, proposal: LogProgressResponse) => {
    if (!proposal.extracted_event) return;
    try {
      setLoading(true);
      const payload = {
        draft_id: proposal.extracted_event.draft_id,
        raw_text: proposal.extracted_event.raw_text,
        normalized_description: editForm.description,
        discipline: editForm.discipline,
        event_type: proposal.extracted_event.event_type,
        location: editForm.location,
        actual_start: editForm.actualStart || undefined,
        actual_finish: editForm.actualFinish || undefined,
        activity_id: editForm.activityId || undefined,
        confidence: proposal.top_candidate?.confidence_score || 0.85,
        reviewer_notes: editForm.notes || 'Edited & confirmed by supervisor',
      };

      const res = await api.confirmProgress(payload);
      setEditingDraftId(null);

      setMessages((prev) =>
        prev.map((m) =>
          m.id === msgId
            ? { ...m, isConfirmed: true, confirmedEventId: res.event_id }
            : m
        )
      );

      const confirmMsg: ChatMessage = {
        id: Date.now().toString(),
        sender: 'agent',
        text: `Modified progress event confirmed! Successfully linked to [${res.activity_id || 'UNLINKED'}] with status "${res.status.toUpperCase()}".`,
      };
      setMessages((prev) => [...prev, confirmMsg]);
      addToast('success', `Modified event successfully committed and linked to ${res.activity_id || 'Unlinked Activity'}`);
    } catch (err: any) {
      addToast('error', `Edit & confirm failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const supervisorPrompts = [
    { text: 'Today we completed erection of spool SP-104 in Area A. Started at 9 AM and finished at 4:30 PM.', mode: 'log' as const, label: 'Spool Erection SP-104' },
    { text: 'Completed fabrication of 8 inch carbon steel pipe spools in Fab Yard Area A.', mode: 'log' as const, label: 'Fab Yard Spools' },
    { text: 'Compressor C-101 RCC foundation concrete pouring second lift completed.', mode: 'log' as const, label: 'Foundation Pour C-101' },
    { text: 'What is the current project status and discipline breakdown?', mode: 'query' as const, label: 'Discipline Breakdown' },
    { text: 'Are there any delays or critical issues reported in the field?', mode: 'query' as const, label: 'Field Delay Audit' },
    { text: 'What can you do?', mode: 'query' as const, label: 'Agent Capabilities' },
  ];

  return (
    <div>
      <div className="top-header">
        <div className="header-title-group">
          <h1>AI Time Agent — Conversational Schedule-Linking Assistant</h1>
          <p>Log actual site progress conversationally or query baseline schedule status, delays, and linkages</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '24px', alignItems: 'start' }}>
        {/* Main Chat Viewport */}
        <div className="glass-card" style={{ padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column', height: '680px' }}>
          {/* Mode Selector Header Bar */}
          <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', backgroundColor: 'rgba(17, 24, 39, 0.95)', padding: '10px 16px', gap: '12px', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                type="button"
                className={`btn btn-sm ${activeMode === 'log' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setActiveMode('log')}
                style={{ fontSize: '0.8rem' }}
              >
                <FilePlus size={14} />
                <span>Log Field Progress (Conversational Ingestion)</span>
              </button>
              <button
                type="button"
                className={`btn btn-sm ${activeMode === 'query' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setActiveMode('query')}
                style={{ fontSize: '0.8rem' }}
              >
                <MessageSquare size={14} />
                <span>Ask Project Status</span>
              </button>
            </div>
            <div style={{ fontSize: '0.725rem', color: 'var(--text-muted)' }}>
              {activeMode === 'log' ? 'Extracts & matches progress against L5/L6 baseline' : 'Queries schedule & variance DB directly'}
            </div>
          </div>

          {/* Messages Container */}
          <div className="chat-messages" style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
            {messages.map((m) => (
              <div
                key={m.id}
                className={`chat-bubble ${m.sender}`}
                style={{
                  maxWidth: '92%',
                  alignSelf: m.sender === 'user' ? 'flex-end' : 'flex-start',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px', fontSize: '0.75rem', opacity: 0.8 }}>
                  {m.sender === 'agent' ? <Bot size={14} color="#38bdf8" /> : null}
                  <span>{m.sender === 'agent' ? 'AI Time Agent' : 'Site Supervisor'}</span>
                  {m.mode === 'log' && (
                    <span style={{ fontSize: '0.7rem', padding: '1px 6px', borderRadius: '4px', backgroundColor: 'rgba(6, 182, 212, 0.2)', color: '#22d3ee' }}>
                      Log Progress
                    </span>
                  )}
                </div>
                <div style={{ fontSize: '0.9rem', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{m.text}</div>

                {/* Structured Log Proposal Confirmation Card */}
                {m.logProposal && m.logProposal.extracted_event && !m.isConfirmed && !m.isCancelled && (
                  <div
                    style={{
                      marginTop: '14px',
                      backgroundColor: 'rgba(15, 23, 42, 0.95)',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius-md)',
                      padding: '16px',
                      color: 'var(--text-primary)',
                    }}
                  >
                    {/* Status Header */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span className="badge badge-discipline">{m.logProposal.extracted_event.discipline}</span>
                        <span className="badge badge-neutral" style={{ textTransform: 'uppercase' }}>
                          {m.logProposal.extracted_event.event_type}
                        </span>
                        <ConfidenceBadge confidence={m.logProposal.top_candidate?.confidence_score} status={m.logProposal.confidence_category} />
                      </div>
                      <div>
                        {m.logProposal.confidence_category === 'high' ? (
                          <span className="badge badge-high" style={{ fontWeight: 700 }}>
                            HIGH CONFIDENCE — READY TO CONFIRM
                          </span>
                        ) : m.logProposal.confidence_category === 'review' ? (
                          <span className="badge badge-medium" style={{ fontWeight: 700 }}>
                            REVIEW REQUIRED
                          </span>
                        ) : (
                          <span className="badge badge-low" style={{ fontWeight: 700 }}>
                            UNMATCHED
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Extracted Fields Matrix */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '10px', backgroundColor: 'rgba(31, 41, 55, 0.6)', padding: '12px', borderRadius: 'var(--radius-md)', marginBottom: '12px', fontSize: '0.78rem' }}>
                      <div>
                        <div style={{ color: 'var(--text-muted)' }}>Location:</div>
                        <div style={{ fontWeight: 600, color: '#f3f4f6' }}>{m.logProposal.extracted_event.location || '—'}</div>
                      </div>
                      <div>
                        <div style={{ color: 'var(--text-muted)' }}>Actual Start:</div>
                        <div className="mono" style={{ color: '#34d399' }}>{m.logProposal.extracted_event.actual_start || '—'}</div>
                      </div>
                      <div>
                        <div style={{ color: 'var(--text-muted)' }}>Actual Finish:</div>
                        <div className="mono" style={{ color: '#38bdf8' }}>{m.logProposal.extracted_event.actual_finish || '—'}</div>
                      </div>
                      <div>
                        <div style={{ color: 'var(--text-muted)' }}>Event Date:</div>
                        <div className="mono" style={{ color: '#cbd5e1' }}>{m.logProposal.extracted_event.date}</div>
                      </div>
                    </div>

                    {/* Matched Activity Section */}
                    {m.logProposal.top_candidate ? (
                      <div style={{ backgroundColor: 'rgba(6, 182, 212, 0.08)', border: '1px solid rgba(6, 182, 212, 0.3)', borderRadius: 'var(--radius-md)', padding: '12px', marginBottom: '12px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--accent-cyan)' }}>
                            PROPOSED MATCHED SCHEDULE ACTIVITY:
                          </span>
                          <span className="mono" style={{ color: 'var(--accent-cyan)', fontWeight: 800 }}>
                            [{m.logProposal.top_candidate.activity_id}]
                          </span>
                        </div>
                        <div style={{ fontSize: '0.875rem', fontWeight: 600, color: '#fff' }}>
                          {m.logProposal.top_candidate.description}
                        </div>
                        {m.logProposal.top_candidate.planned_start && (
                          <div className="mono" style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                            Planned: {m.logProposal.top_candidate.planned_start} → {m.logProposal.top_candidate.planned_finish}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div style={{ color: '#fb7185', fontSize: '0.8rem', marginBottom: '12px', backgroundColor: 'rgba(244, 63, 94, 0.1)', padding: '10px', borderRadius: 'var(--radius-md)' }}>
                        No schedule candidate identified above 30% threshold. Will be saved as unlinked progress event.
                      </div>
                    )}

                    {/* Signal Breakdown */}
                    {m.logProposal.top_candidate && (
                      <div style={{ backgroundColor: 'rgba(17, 24, 39, 0.8)', borderRadius: 'var(--radius-md)', padding: '10px 12px', marginBottom: '12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '6px' }}>
                          <Sliders size={12} />
                          <span>5-SIGNAL MATCH BREAKDOWN (TOTAL CONFIDENCE: {Math.round(m.logProposal.top_candidate.confidence_score * 100)}%)</span>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '6px', fontSize: '0.725rem', textAlign: 'center' }}>
                          <div style={{ background: '#1f2937', padding: '4px', borderRadius: '4px' }}>
                            <div style={{ color: 'var(--text-muted)', fontSize: '0.65rem' }}>Desc (40%)</div>
                            <div className="mono" style={{ fontWeight: 700, color: '#38bdf8' }}>
                              {Math.round(m.logProposal.top_candidate.description_similarity * 100)}%
                            </div>
                          </div>
                          <div style={{ background: '#1f2937', padding: '4px', borderRadius: '4px' }}>
                            <div style={{ color: 'var(--text-muted)', fontSize: '0.65rem' }}>Disc (20%)</div>
                            <div className="mono" style={{ fontWeight: 700, color: '#a78bfa' }}>
                              {Math.round(m.logProposal.top_candidate.discipline_similarity * 100)}%
                            </div>
                          </div>
                          <div style={{ background: '#1f2937', padding: '4px', borderRadius: '4px' }}>
                            <div style={{ color: 'var(--text-muted)', fontSize: '0.65rem' }}>Token (15%)</div>
                            <div className="mono" style={{ fontWeight: 700, color: '#34d399' }}>
                              {Math.round(m.logProposal.top_candidate.token_similarity * 100)}%
                            </div>
                          </div>
                          <div style={{ background: '#1f2937', padding: '4px', borderRadius: '4px' }}>
                            <div style={{ color: 'var(--text-muted)', fontSize: '0.65rem' }}>Loc (15%)</div>
                            <div className="mono" style={{ fontWeight: 700, color: '#fbbf24' }}>
                              {Math.round(m.logProposal.top_candidate.location_similarity * 100)}%
                            </div>
                          </div>
                          <div style={{ background: '#1f2937', padding: '4px', borderRadius: '4px' }}>
                            <div style={{ color: 'var(--text-muted)', fontSize: '0.65rem' }}>Date (10%)</div>
                            <div className="mono" style={{ fontWeight: 700, color: '#f43f5e' }}>
                              {Math.round(m.logProposal.top_candidate.date_compatibility * 100)}%
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Explanation */}
                    {m.logProposal.top_candidate?.explanation && (
                      <div style={{ fontSize: '0.78rem', color: '#93c5fd', marginBottom: '14px', display: 'flex', alignItems: 'flex-start', gap: '6px' }}>
                        <Sparkles size={14} style={{ flexShrink: 0, marginTop: '2px' }} />
                        <span>{m.logProposal.top_candidate.explanation}</span>
                      </div>
                    )}

                    {/* Edit Form Modal/Section */}
                    {editingDraftId === m.logProposal.extracted_event.draft_id ? (
                      <div style={{ backgroundColor: 'rgba(31, 41, 55, 0.9)', padding: '14px', borderRadius: 'var(--radius-md)', marginBottom: '12px', display: 'flex', flexDirection: 'column', gap: '10px', border: '1px solid var(--accent-cyan)' }}>
                        <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--accent-cyan)' }}>Edit Progress Event Details before Confirmation:</div>
                        <input
                          type="text"
                          placeholder="Normalized Description"
                          value={editForm.description}
                          onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                          style={{ backgroundColor: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: '4px', padding: '8px 12px', color: '#fff', fontSize: '0.825rem' }}
                        />
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                          <input
                            type="text"
                            placeholder="Location (e.g. Area A, Unit 2)"
                            value={editForm.location}
                            onChange={(e) => setEditForm({ ...editForm, location: e.target.value })}
                            style={{ backgroundColor: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: '4px', padding: '8px 12px', color: '#fff', fontSize: '0.825rem' }}
                          />
                          <input
                            type="text"
                            placeholder="Activity ID (e.g. PIP-001)"
                            value={editForm.activityId}
                            onChange={(e) => setEditForm({ ...editForm, activityId: e.target.value })}
                            style={{ backgroundColor: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: '4px', padding: '8px 12px', color: '#fff', fontSize: '0.825rem' }}
                          />
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                          <input
                            type="text"
                            placeholder="Actual Start (e.g. 09:00:00)"
                            value={editForm.actualStart}
                            onChange={(e) => setEditForm({ ...editForm, actualStart: e.target.value })}
                            style={{ backgroundColor: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: '4px', padding: '8px 12px', color: '#fff', fontSize: '0.825rem' }}
                          />
                          <input
                            type="text"
                            placeholder="Actual Finish (e.g. 16:30:00)"
                            value={editForm.actualFinish}
                            onChange={(e) => setEditForm({ ...editForm, actualFinish: e.target.value })}
                            style={{ backgroundColor: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: '4px', padding: '8px 12px', color: '#fff', fontSize: '0.825rem' }}
                          />
                        </div>
                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '4px' }}>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => setEditingDraftId(null)}
                          >
                            Cancel Edit
                          </button>
                          <button
                            type="button"
                            className="btn btn-success btn-sm"
                            onClick={() => handleSaveEditAndConfirm(m.id, m.logProposal!)}
                          >
                            Save & Confirm
                          </button>
                        </div>
                      </div>
                    ) : (
                      /* Action Buttons */
                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => handleCancelProgress(m.id)}
                        >
                          <XCircle size={14} />
                          <span>Cancel</span>
                        </button>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => startEdit(m.logProposal!.extracted_event!, m.logProposal!.top_candidate)}
                        >
                          <Edit3 size={14} />
                          <span>Edit Details</span>
                        </button>
                        <button
                          type="button"
                          className="btn btn-success btn-sm"
                          onClick={() => handleConfirmProgress(m.id, m.logProposal!)}
                        >
                          <Check size={14} />
                          <span>CONFIRM & UPDATE</span>
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* Confirmed / Cancelled State Tags */}
                {m.isConfirmed && (
                  <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', gap: '6px', color: '#34d399', fontSize: '0.8rem', fontWeight: 600 }}>
                    <CheckCircle2 size={16} />
                    <span>Committed to database (Event ID: {m.confirmedEventId?.slice(0, 8)})</span>
                  </div>
                )}

                {m.isCancelled && (
                  <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                    <XCircle size={16} />
                    <span>Draft submission cancelled.</span>
                  </div>
                )}

                {/* Query Mode: Relevant Activities & Events */}
                {m.activities && m.activities.length > 0 && (
                  <div style={{ marginTop: '12px', paddingTop: '10px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--accent-cyan)', marginBottom: '6px' }}>
                      RELEVANT SCHEDULE ACTIVITIES:
                    </div>
                    {m.activities.map((a) => (
                      <div key={a.activity_id} style={{ fontSize: '0.78rem', marginBottom: '4px' }}>
                        <span className="mono" style={{ color: '#38bdf8', fontWeight: 600 }}>{a.activity_id}</span> — {a.description}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}

            {loading && (
              <div className="chat-bubble agent" style={{ alignSelf: 'flex-start' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)' }}>
                  <Sparkles size={16} className="spin" color="#06b6d4" />
                  <span>Evaluating input & computing multi-signal schedule alignment...</span>
                </div>
              </div>
            )}
          </div>

          {/* Input Footer */}
          <div style={{ padding: '16px', borderTop: '1px solid var(--border)', display: 'flex', gap: '10px', backgroundColor: 'rgba(17, 24, 39, 0.95)' }}>
            <input
              type="text"
              placeholder={
                activeMode === 'log'
                  ? 'Type progress (e.g. "Today we completed spool erection in Area A. Started at 9 AM...")...'
                  : 'Ask AI Time Agent about project schedule, variances, delays...'
              }
              value={inputQuery}
              onChange={(e) => setInputQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSend();
              }}
              style={{
                flex: 1,
                backgroundColor: 'var(--bg-input)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
                padding: '11px 16px',
                color: '#fff',
                fontSize: '0.875rem',
                outline: 'none',
              }}
            />
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => handleSend()}
              disabled={loading || !inputQuery.trim()}
            >
              <Send size={16} />
              <span>{activeMode === 'log' ? 'Parse & Match' : 'Send'}</span>
            </button>
          </div>
        </div>

        {/* Sidebar Recommended Prompts */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div className="glass-card" style={{ padding: '20px' }}>
            <h3 style={{ fontSize: '0.9rem', fontWeight: 700, color: '#fff', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Sparkles size={16} color="#06b6d4" />
              Quick Supervisor Prompts
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {supervisorPrompts.map((p, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    setActiveMode(p.mode);
                    handleSend(p.text, p.mode);
                  }}
                  style={{
                    textAlign: 'left',
                    background: 'rgba(31, 41, 55, 0.6)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-md)',
                    padding: '10px 12px',
                    color: 'var(--text-secondary)',
                    fontSize: '0.78rem',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = 'var(--accent-cyan)';
                    e.currentTarget.style.color = '#fff';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = 'var(--border)';
                    e.currentTarget.style.color = 'var(--text-secondary)';
                  }}
                >
                  <div style={{ fontWeight: 600, color: '#f3f4f6', marginBottom: '2px', display: 'flex', justifyContent: 'space-between' }}>
                    <span>{p.label}</span>
                    <span style={{ fontSize: '0.65rem', textTransform: 'uppercase', color: p.mode === 'log' ? '#38bdf8' : '#a78bfa' }}>
                      {p.mode}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.725rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {p.text}
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="glass-card" style={{ padding: '16px', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <CheckCircle2 size={14} color="#10b981" />
              Intent Protection Active
            </div>
            Conversational greetings and casual remarks will not trigger unwanted schedule modifications. Field execution events are accurately parsed, matched, and require explicit confirmation.
          </div>
        </div>
      </div>
    </div>
  );
};
