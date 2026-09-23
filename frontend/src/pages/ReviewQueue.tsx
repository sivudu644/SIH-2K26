import React, { useEffect, useState } from 'react';
import {
  ListChecks,
  Check,
  X,
  Sparkles,
  RotateCw,
  Sliders,
  AlertTriangle,
  GitBranch,
} from 'lucide-react';
import { api } from '../api/client';
import { ReviewItem } from '../types';
import { ConfidenceBadge } from '../components/ConfidenceBadge';
import { useToast } from '../components/ToastContext';

export const ReviewQueue: React.FC<{ onReviewCountChange?: (count: number) => void }> = ({
  onReviewCountChange,
}) => {
  const { addToast } = useToast();
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [notes, setNotes] = useState<{ [key: string]: string }>({});
  const [actionStatus, setActionStatus] = useState<string | null>(null);

  const fetchQueue = async () => {
    try {
      setLoading(true);
      const res = await api.getReviewQueue();
      setItems(res.review_items);
      if (onReviewCountChange) {
        onReviewCountChange(res.count);
      }
    } catch (err) {
      console.error('Failed to load review queue:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQueue();
  }, []);

  const handleApprove = async (item: ReviewItem, targetActivityId?: string) => {
    const targetId = item.match_id || item.review_id;
    if (!targetId) return;
    try {
      const actId = targetActivityId || item.activity_id;
      const note = notes[item.review_id] || (targetActivityId ? `Approved candidate ${targetActivityId} by Project Controls Lead` : 'Approved by Project Controls Lead');
      await api.approveMatch(targetId, note, actId);
      const msg = `Match for "${actId}" approved successfully.`;
      setActionStatus(msg);
      addToast('success', `Approved: Linked to schedule activity ${actId}`);
      await fetchQueue();
    } catch (err: any) {
      setActionStatus(`Failed to approve: ${err.message}`);
      addToast('error', `Approval failed: ${err.message}`);
    }
  };

  const handleReject = async (item: ReviewItem) => {
    const targetId = item.match_id || item.review_id;
    if (!targetId) return;
    try {
      const note = notes[item.review_id] || 'Rejected - insufficient semantic alignment';
      await api.rejectMatch(targetId, note);
      const msg = `Match rejected for event "${item.event_description?.slice(0, 30)}...".`;
      setActionStatus(msg);
      addToast('info', `Match rejected and flagged as unlinked.`);
      await fetchQueue();
    } catch (err: any) {
      setActionStatus(`Failed to reject: ${err.message}`);
      addToast('error', `Rejection failed: ${err.message}`);
    }
  };

  return (
    <div>
      <div className="top-header">
        <div className="header-title-group">
          <h1>Human-in-the-Loop Review Queue</h1>
          <p>Supervise and resolve uncertain or ambiguous matches within the confidence threshold [0.65 – 0.84]</p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button type="button" className="btn btn-secondary" onClick={fetchQueue} disabled={loading}>
            <RotateCw size={16} className={loading ? 'spin' : ''} />
            <span>Refresh Queue</span>
          </button>
        </div>
      </div>

      {actionStatus && (
        <div
          style={{
            padding: '12px 18px',
            borderRadius: 'var(--radius-md)',
            backgroundColor: 'rgba(6, 182, 212, 0.15)',
            border: '1px solid rgba(6, 182, 212, 0.3)',
            color: '#22d3ee',
            fontSize: '0.875rem',
            marginBottom: '24px',
          }}
        >
          {actionStatus}
        </div>
      )}

      {/* Queue Items */}
      {items.length === 0 ? (
        <div className="glass-card" style={{ padding: '60px 24px', textAlign: 'center' }}>
          <ListChecks size={48} color="#10b981" style={{ margin: '0 auto 16px' }} />
          <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#fff', marginBottom: '6px' }}>
            Review Queue is Clear!
          </h3>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', maxWidth: '500px', margin: '0 auto' }}>
            All extracted progress events have either met the high-confidence auto-match threshold (≥85%) or have already been reviewed.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {items.map((item) => (
            <div
              key={item.review_id}
              className="glass-card"
              style={{
                borderLeft: item.is_ambiguous ? '4px solid #f43f5e' : '4px solid var(--accent-amber)',
              }}
            >
              {/* Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span className="mono" style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    Review ID: {item.review_id.slice(0, 8)}
                  </span>
                  <ConfidenceBadge confidence={item.confidence} />
                  {item.is_ambiguous ? (
                    <span className="badge badge-low" style={{ display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 700 }}>
                      <AlertTriangle size={12} />
                      AMBIGUOUS MATCH (DELTA &le; 0.08)
                    </span>
                  ) : null}
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    type="button"
                    className="btn btn-success btn-sm"
                    onClick={() => handleApprove(item)}
                  >
                    <Check size={14} />
                    <span>Approve Primary [{item.activity_id}]</span>
                  </button>
                  <button
                    type="button"
                    className="btn btn-danger btn-sm"
                    onClick={() => handleReject(item)}
                  >
                    <X size={14} />
                    <span>Reject / Flag Unlinked</span>
                  </button>
                </div>
              </div>

              {/* Side by side comparison */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px', marginBottom: '16px' }}>
                {/* Captured Event */}
                <div
                  style={{
                    backgroundColor: 'rgba(31, 41, 55, 0.6)',
                    borderRadius: 'var(--radius-md)',
                    padding: '16px',
                    border: '1px solid var(--border)',
                  }}
                >
                  <div style={{ fontSize: '0.725rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '6px' }}>
                    Extracted Progress Event
                  </div>
                  <div style={{ fontSize: '0.925rem', fontWeight: 600, color: '#f9fafb', lineHeight: 1.4 }}>
                    "{item.event_description}"
                  </div>
                </div>

                {/* Primary Proposed L5/L6 Activity */}
                <div
                  style={{
                    backgroundColor: 'rgba(6, 182, 212, 0.06)',
                    borderRadius: 'var(--radius-md)',
                    padding: '16px',
                    border: '1px solid rgba(6, 182, 212, 0.25)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <div style={{ fontSize: '0.725rem', fontWeight: 700, color: 'var(--accent-cyan)', textTransform: 'uppercase' }}>
                      Primary Candidate Match ({Math.round(item.confidence * 100)}%)
                    </div>
                    <span className="mono" style={{ color: 'var(--accent-cyan)', fontWeight: 700, fontSize: '0.85rem' }}>
                      {item.activity_id}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.925rem', fontWeight: 600, color: '#f9fafb', lineHeight: 1.4 }}>
                    "{item.activity_description}"
                  </div>
                </div>

                {/* Alternative Candidate Match (if ambiguous) */}
                {item.alternative_activity_id && (
                  <div
                    style={{
                      backgroundColor: 'rgba(244, 63, 94, 0.06)',
                      borderRadius: 'var(--radius-md)',
                      padding: '16px',
                      border: '1px solid rgba(244, 63, 94, 0.3)',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                      <div style={{ fontSize: '0.725rem', fontWeight: 700, color: '#fb7185', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <GitBranch size={12} />
                        Alternative Candidate ({Math.round((item.alternative_confidence || 0) * 100)}%)
                      </div>
                      <span className="mono" style={{ color: '#fb7185', fontWeight: 700, fontSize: '0.85rem' }}>
                        {item.alternative_activity_id}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.925rem', fontWeight: 600, color: '#f9fafb', lineHeight: 1.4, marginBottom: '10px' }}>
                      "{item.alternative_activity_desc}"
                    </div>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => handleApprove(item, item.alternative_activity_id)}
                      style={{ fontSize: '0.75rem', backgroundColor: 'rgba(244, 63, 94, 0.15)', color: '#fb7185', borderColor: 'rgba(244, 63, 94, 0.4)' }}
                    >
                      <Check size={12} />
                      <span>Choose Alternative [{item.alternative_activity_id}]</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Multi-Signal Breakdown Pill Bars */}
              <div style={{ backgroundColor: 'rgba(17, 24, 39, 0.7)', borderRadius: 'var(--radius-md)', padding: '12px 16px', marginBottom: '14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '8px' }}>
                  <Sliders size={14} />
                  <span>MULTI-SIGNAL MATCH BREAKDOWN</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '10px', fontSize: '0.75rem' }}>
                  <div>
                    <div style={{ color: 'var(--text-muted)' }}>Semantic Desc (40%)</div>
                    <div className="mono" style={{ fontWeight: 700, color: '#38bdf8' }}>
                      {Math.round((item.description_similarity || 0) * 100)}%
                    </div>
                  </div>
                  <div>
                    <div style={{ color: 'var(--text-muted)' }}>Discipline (20%)</div>
                    <div className="mono" style={{ fontWeight: 700, color: '#a78bfa' }}>
                      {Math.round((item.discipline_similarity || 0) * 100)}%
                    </div>
                  </div>
                  <div>
                    <div style={{ color: 'var(--text-muted)' }}>Token / ID (15%)</div>
                    <div className="mono" style={{ fontWeight: 700, color: '#34d399' }}>
                      {Math.round((item.token_similarity || 0) * 100)}%
                    </div>
                  </div>
                  <div>
                    <div style={{ color: 'var(--text-muted)' }}>Location (15%)</div>
                    <div className="mono" style={{ fontWeight: 700, color: '#fbbf24' }}>
                      {Math.round((item.location_similarity || 0) * 100)}%
                    </div>
                  </div>
                  <div>
                    <div style={{ color: 'var(--text-muted)' }}>Date Compat (10%)</div>
                    <div className="mono" style={{ fontWeight: 700, color: '#f43f5e' }}>
                      {Math.round((item.date_compatibility || 0) * 100)}%
                    </div>
                  </div>
                </div>
              </div>

              {/* AI Explanation & Notes */}
              {item.explanation && (
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', fontSize: '0.8rem', color: '#93c5fd', marginBottom: '12px' }}>
                  <Sparkles size={16} color="#60a5fa" style={{ flexShrink: 0, marginTop: '2px' }} />
                  <span>{item.explanation}</span>
                </div>
              )}

              {/* Reviewer Note Input */}
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <input
                  type="text"
                  placeholder="Optional review annotation / engineering remark..."
                  value={notes[item.review_id] || ''}
                  onChange={(e) => setNotes({ ...notes, [item.review_id]: e.target.value })}
                  style={{
                    flex: 1,
                    backgroundColor: 'var(--bg-input)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-md)',
                    padding: '8px 12px',
                    color: '#fff',
                    fontSize: '0.825rem',
                    outline: 'none',
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
