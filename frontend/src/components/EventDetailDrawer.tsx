import React, { useEffect, useState } from 'react';
import {
  X,
  FileText,
  Sparkles,
  History,
  GitMerge,
  Layers,
} from 'lucide-react';
import { ProgressEvent, ScheduleActivity, AuditLog } from '../types';
import { ConfidenceBadge } from './ConfidenceBadge';
import { api } from '../api/client';

interface Props {
  event: ProgressEvent | null;
  onClose: () => void;
  onOpenActivity?: (activity: ScheduleActivity) => void;
}

export const EventDetailDrawer: React.FC<Props> = ({ event, onClose, onOpenActivity }) => {
  const [matchedActivity, setMatchedActivity] = useState<ScheduleActivity | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!event) return;

    const fetchDetails = async () => {
      setLoading(true);
      try {
        const [actRes, auditRes] = await Promise.all([
          api.getActivities(event.discipline),
          api.getAudit(100),
        ]);

        if (event.activity_id) {
          const act = actRes.activities.find((a) => a.activity_id === event.activity_id);
          setMatchedActivity(act || null);
        } else {
          setMatchedActivity(null);
        }

        const relevantAudits = auditRes.audit_logs.filter(
          (a) =>
            a.entity_id === event.event_id ||
            (event.activity_id && a.entity_id === event.activity_id) ||
            (a.details && (a.details.includes(event.event_id) || (event.activity_id && a.details.includes(event.activity_id))))
        );
        setAuditLogs(relevantAudits);
      } catch (err) {
        console.error('Failed to load event details:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchDetails();
  }, [event]);

  if (!event) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        right: 0,
        bottom: 0,
        left: 0,
        zIndex: 50,
        display: 'flex',
        justifyContent: 'flex-end',
        backgroundColor: 'rgba(0, 0, 0, 0.65)',
        backdropFilter: 'blur(4px)',
        animation: 'fadeIn 0.2s ease-out',
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '580px',
          backgroundColor: '#0f172a',
          borderLeft: '1px solid var(--border)',
          height: '100%',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '-10px 0 30px rgba(0, 0, 0, 0.7)',
          animation: 'slideInRight 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drawer Header */}
        <div
          style={{
            padding: '24px',
            borderBottom: '1px solid var(--border)',
            backgroundColor: 'rgba(17, 24, 39, 0.95)',
            position: 'sticky',
            top: 0,
            zIndex: 10,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: '16px',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
              <span className="mono" style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                EVENT: {event.event_id.slice(0, 8)}...
              </span>
              <span className="badge badge-discipline">{event.discipline}</span>
              <ConfidenceBadge confidence={event.confidence} status={event.status} />
            </div>
            <h2 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#fff', lineHeight: 1.3 }}>
              {event.normalized_description || event.raw_text}
            </h2>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
              Source: {event.source_document || 'Conversational Field Input'}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid var(--border)',
              color: 'var(--text-secondary)',
              borderRadius: 'var(--radius-md)',
              width: '32px',
              height: '32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              flexShrink: 0,
            }}
            aria-label="Close drawer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Drawer Content */}
        <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px', flex: 1 }}>
          {/* Step 1: VERBATIM SUPERVISOR REPORT */}
          <div
            style={{
              backgroundColor: 'rgba(31, 41, 55, 0.5)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              padding: '16px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px' }}>
              <FileText size={14} />
              <span>1. ORIGINAL SUPERVISOR RAW MESSAGE</span>
            </div>
            <div style={{ fontSize: '0.875rem', color: '#f8fafc', fontStyle: 'italic', backgroundColor: 'rgba(15, 23, 42, 0.6)', padding: '12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
              "{event.raw_text || event.normalized_description}"
            </div>
          </div>

          {/* Step 2: EXTRACTED FIELDS MATRIX */}
          <div
            style={{
              backgroundColor: 'rgba(6, 182, 212, 0.05)',
              border: '1px solid rgba(6, 182, 212, 0.25)',
              borderRadius: 'var(--radius-md)',
              padding: '16px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', fontWeight: 700, color: 'var(--accent-cyan)', textTransform: 'uppercase', marginBottom: '12px' }}>
              <Sparkles size={14} />
              <span>2. AI EXTRACTED EXECUTION FIELDS</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '0.8rem' }}>
              <div>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.725rem' }}>Discipline:</div>
                <div style={{ fontWeight: 600, color: '#f1f5f9', marginTop: '2px', textTransform: 'capitalize' }}>
                  {event.discipline || 'General'}
                </div>
              </div>
              <div>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.725rem' }}>Event Type:</div>
                <div style={{ fontWeight: 600, color: '#f1f5f9', marginTop: '2px', textTransform: 'capitalize' }}>
                  {event.event_type || 'Progress'}
                </div>
              </div>
              <div>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.725rem' }}>Actual Start Timestamp:</div>
                <div className="mono" style={{ fontWeight: 600, color: event.actual_start ? '#34d399' : 'var(--text-muted)', marginTop: '2px' }}>
                  {event.actual_start || 'Not recorded'}
                </div>
              </div>
              <div>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.725rem' }}>Actual Finish Timestamp:</div>
                <div className="mono" style={{ fontWeight: 600, color: event.actual_finish ? '#38bdf8' : 'var(--text-muted)', marginTop: '2px' }}>
                  {event.actual_finish || 'Not recorded'}
                </div>
              </div>
            </div>
          </div>

          {/* Step 3: MATCHED L5/L6 ACTIVITY */}
          <div
            style={{
              backgroundColor: 'rgba(99, 102, 241, 0.05)',
              border: '1px solid rgba(99, 102, 241, 0.25)',
              borderRadius: 'var(--radius-md)',
              padding: '16px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', fontWeight: 700, color: 'var(--accent-indigo)', textTransform: 'uppercase', marginBottom: '12px' }}>
              <GitMerge size={14} />
              <span>3. SCHEDULE LINKAGE & CONFIDENCE ROUTING</span>
            </div>
            {event.activity_id ? (
              <div>
                <div
                  style={{
                    backgroundColor: 'rgba(15, 23, 42, 0.7)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '12px',
                    cursor: onOpenActivity && matchedActivity ? 'pointer' : 'default',
                  }}
                  onClick={() => onOpenActivity && matchedActivity && onOpenActivity(matchedActivity)}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <span className="mono" style={{ color: 'var(--accent-cyan)', fontWeight: 800 }}>
                      [{event.activity_id}]
                    </span>
                    <ConfidenceBadge confidence={event.confidence} status={event.status} />
                  </div>
                  <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#fff' }}>
                    {matchedActivity?.description || 'Schedule Activity'}
                  </div>
                  {matchedActivity && (
                    <div className="mono" style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                      Baseline Planned: {matchedActivity.planned_start} → {matchedActivity.planned_finish} ({matchedActivity.location || 'Site'})
                    </div>
                  )}
                </div>
                {onOpenActivity && matchedActivity && (
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    style={{ marginTop: '10px', fontSize: '0.75rem' }}
                    onClick={() => onOpenActivity(matchedActivity)}
                  >
                    <Layers size={13} />
                    <span>View Activity Details</span>
                  </button>
                )}
              </div>
            ) : (
              <div style={{ color: '#fb7185', fontSize: '0.8rem' }}>
                Unmatched: Progress captured but not linked to any baseline schedule activity (&lt;65% confidence).
              </div>
            )}
          </div>

          {/* Step 4: AUDIT TRAIL */}
          <div
            style={{
              backgroundColor: 'rgba(31, 41, 55, 0.4)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              padding: '16px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', fontWeight: 700, color: 'var(--accent-amber)', textTransform: 'uppercase', marginBottom: '12px' }}>
              <History size={14} />
              <span>4. EVENT AUDIT PROVENANCE</span>
            </div>
            {auditLogs.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '180px', overflowY: 'auto' }}>
                {auditLogs.map((log) => (
                  <div key={log.audit_id} style={{ fontSize: '0.75rem', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '6px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)' }}>
                      <span className="mono">{log.timestamp.slice(0, 19).replace('T', ' ')}</span>
                      <span className="badge badge-neutral" style={{ fontSize: '0.65rem' }}>{log.user}</span>
                    </div>
                    <div style={{ color: 'var(--text-secondary)', marginTop: '2px' }}>{log.details || log.action}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                {loading ? 'Loading audit trail...' : 'No audit entries found.'}
              </div>
            )}
          </div>
        </div>

        {/* Drawer Footer */}
        <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border)', backgroundColor: 'rgba(17, 24, 39, 0.95)', display: 'flex', justifyContent: 'flex-end' }}>
          <button type="button" className="btn btn-secondary btn-sm" onClick={onClose}>
            Close Drawer
          </button>
        </div>
      </div>
    </div>
  );
};
