import React, { useState, useEffect, useRef } from 'react';
import { Search, X, Layers, ActivitySquare, ArrowRight } from 'lucide-react';
import { ScheduleActivity, ProgressEvent } from '../types';
import { ConfidenceBadge } from './ConfidenceBadge';
import { api } from '../api/client';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  activities?: ScheduleActivity[];
  events?: ProgressEvent[];
  onSelectActivity: (act: ScheduleActivity) => void;
  onSelectEvent: (evt: ProgressEvent) => void;
}

export const GlobalSearchModal: React.FC<Props> = ({
  isOpen,
  onClose,
  activities: initialActivities,
  events: initialEvents,
  onSelectActivity,
  onSelectEvent,
}) => {
  const [query, setQuery] = useState('');
  const [activities, setActivities] = useState<ScheduleActivity[]>(initialActivities || []);
  const [events, setEvents] = useState<ProgressEvent[]>(initialEvents || []);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
      if (!initialActivities || initialActivities.length === 0) {
        api.getActivities().then((res) => setActivities(res.activities)).catch(() => {});
      }
      if (!initialEvents || initialEvents.length === 0) {
        api.getProgressEvents().then((res) => setEvents(res.events)).catch(() => {});
      }
    } else {
      setQuery('');
    }
  }, [isOpen, initialActivities, initialEvents]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        if (isOpen) {
          onClose();
        }
      }
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const q = query.trim().toLowerCase();

  const matchingActivities = q
    ? activities.filter(
        (a) =>
          a.activity_id.toLowerCase().includes(q) ||
          a.description.toLowerCase().includes(q) ||
          a.wbs.toLowerCase().includes(q) ||
          (a.location && a.location.toLowerCase().includes(q)) ||
          a.discipline.toLowerCase().includes(q)
      ).slice(0, 5)
    : activities.slice(0, 4);

  const matchingEvents = q
    ? events.filter(
        (e) =>
          (e.raw_text && e.raw_text.toLowerCase().includes(q)) ||
          (e.normalized_description && e.normalized_description.toLowerCase().includes(q)) ||
          (e.activity_id && e.activity_id.toLowerCase().includes(q)) ||
          (e.discipline && e.discipline.toLowerCase().includes(q))
      ).slice(0, 5)
    : events.slice(0, 3);

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        right: 0,
        bottom: 0,
        left: 0,
        zIndex: 100,
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        paddingTop: '100px',
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        backdropFilter: 'blur(6px)',
        animation: 'fadeIn 0.15s ease-out',
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '640px',
          backgroundColor: '#111827',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.8), 0 0 20px rgba(6, 182, 212, 0.2)',
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input Bar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '16px 20px',
            borderBottom: '1px solid var(--border)',
            backgroundColor: 'rgba(31, 41, 55, 0.6)',
          }}
        >
          <Search size={20} color="var(--accent-cyan)" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Search activities, WBS, events, locations, disciplines..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{
              flex: 1,
              backgroundColor: 'transparent',
              border: 'none',
              outline: 'none',
              color: '#fff',
              fontSize: '1rem',
              fontFamily: 'inherit',
            }}
          />
          <span
            style={{
              fontSize: '0.7rem',
              padding: '2px 6px',
              borderRadius: '4px',
              backgroundColor: 'rgba(255, 255, 255, 0.1)',
              color: 'var(--text-muted)',
            }}
          >
            ESC to close
          </span>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              padding: '2px',
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Results Container */}
        <div style={{ maxHeight: '420px', overflowY: 'auto', padding: '16px' }}>
          {/* Activities Section */}
          <div style={{ marginBottom: '16px' }}>
            <div
              style={{
                fontSize: '0.725rem',
                fontWeight: 700,
                color: 'var(--text-muted)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                marginBottom: '8px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <Layers size={14} color="#38bdf8" />
              <span>Schedule Baseline Activities ({matchingActivities.length})</span>
            </div>

            {matchingActivities.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {matchingActivities.map((act) => (
                  <div
                    key={act.activity_id}
                    onClick={() => {
                      onSelectActivity(act);
                      onClose();
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 14px',
                      borderRadius: 'var(--radius-md)',
                      backgroundColor: 'rgba(31, 41, 55, 0.4)',
                      border: '1px solid transparent',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = 'rgba(6, 182, 212, 0.1)';
                      e.currentTarget.style.borderColor = 'rgba(6, 182, 212, 0.3)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'rgba(31, 41, 55, 0.4)';
                      e.currentTarget.style.borderColor = 'transparent';
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
                        <span className="mono" style={{ color: 'var(--accent-cyan)', fontWeight: 700, fontSize: '0.825rem' }}>
                          {act.activity_id}
                        </span>
                        <span className="badge badge-discipline" style={{ fontSize: '0.675rem', padding: '1px 6px' }}>
                          {act.discipline}
                        </span>
                        {act.location && (
                          <span style={{ fontSize: '0.725rem', color: 'var(--text-muted)' }}>
                            • {act.location}
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: '0.85rem', color: '#f3f4f6', fontWeight: 500 }}>
                        {act.description}
                      </div>
                    </div>
                    <ArrowRight size={14} color="var(--text-muted)" />
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', padding: '6px 0' }}>
                No matching activities found.
              </div>
            )}
          </div>

          {/* Progress Events Section */}
          <div>
            <div
              style={{
                fontSize: '0.725rem',
                fontWeight: 700,
                color: 'var(--text-muted)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                marginBottom: '8px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <ActivitySquare size={14} color="#a855f7" />
              <span>Captured Progress Events ({matchingEvents.length})</span>
            </div>

            {matchingEvents.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {matchingEvents.map((evt) => (
                  <div
                    key={evt.event_id}
                    onClick={() => {
                      onSelectEvent(evt);
                      onClose();
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 14px',
                      borderRadius: 'var(--radius-md)',
                      backgroundColor: 'rgba(31, 41, 55, 0.4)',
                      border: '1px solid transparent',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = 'rgba(168, 85, 247, 0.1)';
                      e.currentTarget.style.borderColor = 'rgba(168, 85, 247, 0.3)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'rgba(31, 41, 55, 0.4)';
                      e.currentTarget.style.borderColor = 'transparent';
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
                        <span className="mono" style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                          {evt.event_id.slice(0, 8)}...
                        </span>
                        <span className="badge badge-discipline" style={{ fontSize: '0.675rem', padding: '1px 6px' }}>
                          {evt.discipline}
                        </span>
                        <ConfidenceBadge confidence={evt.confidence} status={evt.status} />
                      </div>
                      <div style={{ fontSize: '0.85rem', color: '#f3f4f6', fontWeight: 500 }}>
                        {evt.normalized_description || evt.raw_text}
                      </div>
                    </div>
                    <ArrowRight size={14} color="var(--text-muted)" />
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', padding: '6px 0' }}>
                No matching progress events found.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
