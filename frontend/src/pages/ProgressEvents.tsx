import React, { useEffect, useState } from 'react';
import { Search, Filter, ActivitySquare, RotateCw, ArrowUpRight } from 'lucide-react';
import { api } from '../api/client';
import { ProgressEvent } from '../types';
import { ConfidenceBadge } from '../components/ConfidenceBadge';
import { EventDetailDrawer } from '../components/EventDetailDrawer';

interface Props {
  initialStatus?: string;
  initialDiscipline?: string;
  onOpenEventDetail?: (event: ProgressEvent) => void;
}

export const ProgressEvents: React.FC<Props> = ({
  initialStatus,
  initialDiscipline,
  onOpenEventDetail,
}) => {
  const [events, setEvents] = useState<ProgressEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>(initialStatus || 'all');
  const [disciplineFilter, setDisciplineFilter] = useState<string>(initialDiscipline || 'all');
  const [eventTypeFilter, setEventTypeFilter] = useState<string>('all');
  const [selectedEvent, setSelectedEvent] = useState<ProgressEvent | null>(null);

  useEffect(() => {
    if (initialStatus !== undefined) {
      setStatusFilter(initialStatus);
    }
    if (initialDiscipline !== undefined) {
      setDisciplineFilter(initialDiscipline);
    }
  }, [initialStatus, initialDiscipline]);

  const fetchEvents = async () => {
    try {
      setLoading(true);
      const res = await api.getProgressEvents(
        statusFilter !== 'all' ? statusFilter : undefined,
        disciplineFilter !== 'all' ? disciplineFilter : undefined
      );
      setEvents(res.events);
    } catch (err) {
      console.error('Failed to load progress events:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, [statusFilter, disciplineFilter]);

  const filtered = events.filter((e) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      (e.raw_text && e.raw_text.toLowerCase().includes(q)) ||
      (e.normalized_description && e.normalized_description.toLowerCase().includes(q)) ||
      (e.activity_id && e.activity_id.toLowerCase().includes(q)) ||
      (e.source_document && e.source_document.toLowerCase().includes(q)) ||
      (e.location && e.location.toLowerCase().includes(q));

    const matchesType =
      eventTypeFilter === 'all' ||
      (e.event_type && e.event_type.toLowerCase() === eventTypeFilter.toLowerCase());

    return matchesSearch && matchesType;
  });

  return (
    <div>
      <div className="top-header">
        <div className="header-title-group">
          <h1>Captured Progress Events Repository</h1>
          <p>Structured actual progress events extracted from heterogeneous daily and discipline reports</p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button type="button" className="btn btn-secondary" onClick={fetchEvents} disabled={loading}>
            <RotateCw size={16} className={loading ? 'spin' : ''} />
            <span>Refresh Events</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="glass-card" style={{ marginBottom: '24px', padding: '16px 20px' }}>
        <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap', alignItems: 'center' }}>
          {/* Search box */}
          <div style={{ flex: 1, minWidth: '260px', position: 'relative' }}>
            <Search
              size={18}
              style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}
            />
            <input
              type="text"
              placeholder="Search by description, source document, location, or linked activity ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                backgroundColor: 'var(--bg-input)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
                padding: '9px 12px 9px 38px',
                color: '#fff',
                fontSize: '0.85rem',
                outline: 'none',
              }}
            />
          </div>

          {/* Status selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Filter size={16} color="var(--text-muted)" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{
                backgroundColor: 'var(--bg-input)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
                padding: '9px 14px',
                color: '#fff',
                fontSize: '0.85rem',
                outline: 'none',
                cursor: 'pointer',
              }}
            >
              <option value="all">All Statuses</option>
              <option value="matched">Matched (Auto)</option>
              <option value="review">Review Queue</option>
              <option value="approved">Human Approved</option>
              <option value="unmatched">Unmatched</option>
              <option value="extracted">Newly Extracted</option>
            </select>
          </div>

          {/* Discipline selector */}
          <select
            value={disciplineFilter}
            onChange={(e) => setDisciplineFilter(e.target.value)}
            style={{
              backgroundColor: 'var(--bg-input)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              padding: '9px 14px',
              color: '#fff',
              fontSize: '0.85rem',
              outline: 'none',
              cursor: 'pointer',
            }}
          >
            <option value="all">All Disciplines</option>
            <option value="piping">Piping</option>
            <option value="civil">Civil</option>
            <option value="electrical">Electrical</option>
            <option value="mechanical">Mechanical</option>
            <option value="instrumentation">Instrumentation</option>
          </select>

          {/* Event Type selector */}
          <select
            value={eventTypeFilter}
            onChange={(e) => setEventTypeFilter(e.target.value)}
            style={{
              backgroundColor: 'var(--bg-input)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              padding: '9px 14px',
              color: '#fff',
              fontSize: '0.85rem',
              outline: 'none',
              cursor: 'pointer',
            }}
          >
            <option value="all">All Event Types</option>
            <option value="erection">Erection</option>
            <option value="fabrication">Fabrication</option>
            <option value="concrete_pour">Concrete Pour</option>
            <option value="cable_pull">Cable Pull</option>
            <option value="testing">Testing / Hydrotest</option>
            <option value="general">General Progress</option>
          </select>
        </div>
      </div>

      {/* Events Table */}
      <div className="glass-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ActivitySquare size={18} color="#6366f1" />
            <span style={{ fontWeight: 700, fontSize: '0.95rem', color: '#fff' }}>
              {filtered.length} Progress Events
            </span>
          </div>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            Click any row to inspect complete match signal breakdown & audit trail
          </span>
        </div>

        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Event ID</th>
                <th>Source Document</th>
                <th>Discipline</th>
                <th>Extracted Description</th>
                <th>Location</th>
                <th>Actual Window</th>
                <th>Linked Schedule Activity</th>
                <th>Confidence & Status</th>
                <th style={{ textAlign: 'center' }}>Details</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length > 0 ? (
                filtered.map((evt) => (
                  <tr
                    key={evt.event_id}
                    className="clickable-row"
                    onClick={() => (onOpenEventDetail ? onOpenEventDetail(evt) : setSelectedEvent(evt))}
                  >
                    <td className="mono" style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      {evt.event_id.slice(0, 8)}...
                    </td>
                    <td style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                      {evt.source_document || '—'}
                    </td>
                    <td>
                      <span className="badge badge-discipline">{evt.discipline}</span>
                    </td>
                    <td style={{ maxWidth: '320px' }}>
                      <div style={{ fontWeight: 600, color: '#f3f4f6' }}>
                        {evt.normalized_description || evt.raw_text}
                      </div>
                      {evt.normalized_description && evt.raw_text !== evt.normalized_description && (
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                          Raw: "{evt.raw_text}"
                        </div>
                      )}
                    </td>
                    <td style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                      {evt.location || '—'}
                    </td>
                    <td className="mono" style={{ fontSize: '0.78rem' }}>
                      {evt.actual_start || evt.actual_finish ? (
                        <span>
                          {evt.actual_start ? evt.actual_start : '—'}
                          {evt.actual_finish ? ` → ${evt.actual_finish}` : ''}
                        </span>
                      ) : (
                        <span style={{ color: 'var(--text-muted)' }}>Date: {evt.date || '—'}</span>
                      )}
                    </td>
                    <td>
                      {evt.activity_id ? (
                        <span className="mono" style={{ color: 'var(--accent-cyan)', fontWeight: 700 }}>
                          {evt.activity_id}
                        </span>
                      ) : (
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Unlinked</span>
                      )}
                    </td>
                    <td>
                      <ConfidenceBadge confidence={evt.confidence} status={evt.status} />
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (onOpenEventDetail) onOpenEventDetail(evt);
                          else setSelectedEvent(evt);
                        }}
                        style={{ padding: '4px 8px' }}
                      >
                        <ArrowUpRight size={14} />
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={9} style={{ textAlign: 'center', padding: '36px', color: 'var(--text-muted)' }}>
                    {loading ? 'Loading progress events repository...' : 'No progress events found matching the criteria.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Event Detail Slide-over Drawer */}
      {selectedEvent && (
        <EventDetailDrawer
          event={selectedEvent}
          onClose={() => setSelectedEvent(null)}
        />
      )}
    </div>
  );
};
