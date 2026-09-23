import React, { useEffect, useState } from 'react';
import {
  X,
  Calendar,
  MapPin,
  History,
  Activity,
  GitMerge,
} from 'lucide-react';
import { ScheduleActivity, ProgressEvent, AuditLog } from '../types';
import { ConfidenceBadge } from './ConfidenceBadge';
import { api } from '../api/client';

interface Props {
  activity: ScheduleActivity | null;
  onClose: () => void;
  onOpenEvent?: (event: ProgressEvent) => void;
}

export const ActivityDetailDrawer: React.FC<Props> = ({ activity, onClose, onOpenEvent }) => {
  const [linkedEvents, setLinkedEvents] = useState<ProgressEvent[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!activity) return;

    const fetchDetails = async () => {
      setLoading(true);
      try {
        const [eventsRes, auditRes] = await Promise.all([
          api.getProgressEvents(undefined, activity.discipline),
          api.getAudit(100),
        ]);

        const matchingEvents = eventsRes.events.filter(
          (e) => e.activity_id === activity.activity_id
        );
        setLinkedEvents(matchingEvents);

        const relevantAudits = auditRes.audit_logs.filter(
          (a) =>
            a.entity_id === activity.activity_id ||
            matchingEvents.some((e) => a.entity_id === e.event_id) ||
            (a.details && a.details.includes(activity.activity_id))
        );
        setAuditLogs(relevantAudits);
      } catch (err) {
        console.error('Failed to load activity extra details:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchDetails();
  }, [activity]);

  if (!activity) return null;

  const isCompleted = activity.status === 'completed';
  const isInProgress = activity.status === 'in_progress';
  const isDelayed = activity.status === 'delayed';

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
              <span className="mono" style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--accent-cyan)' }}>
                {activity.activity_id}
              </span>
              <span className="badge badge-discipline">{activity.discipline}</span>
              <span
                className={`badge ${
                  isCompleted ? 'badge-high' : isInProgress ? 'badge-medium' : isDelayed ? 'badge-low' : 'badge-neutral'
                }`}
                style={{ textTransform: 'capitalize' }}
              >
                {activity.status.replace('_', ' ')}
              </span>
            </div>
            <h2 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#fff', lineHeight: 1.3 }}>
              {activity.description}
            </h2>
            <div className="mono" style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
              WBS: {activity.wbs}
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
          {/* Section 1: PLANNED (Baseline Schedule) */}
          <div
            style={{
              backgroundColor: 'rgba(30, 41, 59, 0.5)',
              border: '1px solid rgba(56, 189, 248, 0.2)',
              borderRadius: 'var(--radius-md)',
              padding: '16px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', fontWeight: 700, color: '#38bdf8', textTransform: 'uppercase', marginBottom: '12px' }}>
              <Calendar size={14} />
              <span>PLANNED BASELINE SCHEDULE (L5/L6)</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '0.825rem' }}>
              <div>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.725rem' }}>Planned Start:</div>
                <div className="mono" style={{ fontWeight: 600, color: '#f1f5f9', marginTop: '2px' }}>
                  {activity.planned_start || 'Not recorded'}
                </div>
              </div>
              <div>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.725rem' }}>Planned Finish:</div>
                <div className="mono" style={{ fontWeight: 600, color: '#f1f5f9', marginTop: '2px' }}>
                  {activity.planned_finish || 'Not recorded'}
                </div>
              </div>
              <div style={{ gridColumn: 'span 2' }}>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.725rem' }}>Location / Unit Area:</div>
                <div style={{ fontWeight: 500, color: '#e2e8f0', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <MapPin size={13} color="var(--text-muted)" />
                  <span>{activity.location || 'Not recorded'}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: ACTUAL (Execution Capture) */}
          <div
            style={{
              backgroundColor: 'rgba(16, 185, 129, 0.05)',
              border: '1px solid rgba(16, 185, 129, 0.25)',
              borderRadius: 'var(--radius-md)',
              padding: '16px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', fontWeight: 700, color: '#34d399', textTransform: 'uppercase', marginBottom: '12px' }}>
              <Activity size={14} />
              <span>ACTUAL FIELD EXECUTION (VERIFIED ACTUALS)</span>
            </div>
            {linkedEvents.length > 0 ? (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '0.825rem' }}>
                <div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.725rem' }}>Actual Start:</div>
                  <div className="mono" style={{ fontWeight: 600, color: '#34d399', marginTop: '2px' }}>
                    {linkedEvents.find((e) => e.actual_start)?.actual_start || 'Not recorded'}
                  </div>
                </div>
                <div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.725rem' }}>Actual Finish:</div>
                  <div className="mono" style={{ fontWeight: 600, color: '#38bdf8', marginTop: '2px' }}>
                    {linkedEvents.find((e) => e.actual_finish)?.actual_finish || (isCompleted ? 'Completed' : 'Not recorded')}
                  </div>
                </div>
                <div style={{ gridColumn: 'span 2' }}>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.725rem' }}>Linked Progress Events:</div>
                  <div style={{ fontWeight: 600, color: '#fff', marginTop: '2px' }}>
                    {linkedEvents.length} execution event{linkedEvents.length > 1 ? 's' : ''} verified
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                No actual progress events linked to this activity yet.
              </div>
            )}
          </div>

          {/* Section 3: AI MATCH & HUMAN CONFIRMATION PROVENANCE */}
          <div
            style={{
              backgroundColor: 'rgba(31, 41, 55, 0.4)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              padding: '16px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', fontWeight: 700, color: 'var(--accent-indigo)', textTransform: 'uppercase', marginBottom: '12px' }}>
              <GitMerge size={14} />
              <span>AI MATCH & HUMAN CONFIRMATION PROVENANCE</span>
            </div>
            {linkedEvents.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {linkedEvents.map((evt) => (
                  <div
                    key={evt.event_id}
                    style={{
                      backgroundColor: 'rgba(15, 23, 42, 0.6)',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius-sm)',
                      padding: '10px 12px',
                      cursor: onOpenEvent ? 'pointer' : 'default',
                    }}
                    onClick={() => onOpenEvent && onOpenEvent(evt)}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                      <span className="mono" style={{ fontSize: '0.75rem', color: 'var(--accent-cyan)' }}>
                        Event ID: {evt.event_id.slice(0, 8)}...
                      </span>
                      <ConfidenceBadge confidence={evt.confidence} status={evt.status} />
                    </div>
                    <div style={{ fontSize: '0.8rem', color: '#f3f4f6' }}>
                      "{evt.normalized_description || evt.raw_text}"
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                      <span>Source: {evt.source_document || 'Field Input'}</span>
                      <span className="mono">{evt.created_at?.slice(0, 10)}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                Activity awaiting progress reports or conversational updates.
              </div>
            )}
          </div>

          {/* Section 4: AUDIT TRAIL LOGS */}
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
              <span>ACTIVITY AUDIT HISTORY</span>
            </div>
            {auditLogs.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '200px', overflowY: 'auto' }}>
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
                {loading ? 'Checking audit records...' : 'No specific audit records for this activity yet.'}
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
