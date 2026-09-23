import React, { useEffect, useState } from 'react';
import {
  Search,
  Filter,
  Layers,
  RotateCw,
  CheckCircle2,
  Clock,
  AlertTriangle,
  ArrowUpRight,
} from 'lucide-react';
import { api } from '../api/client';
import { ScheduleActivity } from '../types';
import { useToast } from '../components/ToastContext';
import { ActivityDetailDrawer } from '../components/ActivityDetailDrawer';

interface Props {
  initialDiscipline?: string;
  onOpenActivityDetail?: (activity: ScheduleActivity) => void;
}

export const ScheduleExplorer: React.FC<Props> = ({
  initialDiscipline,
  onOpenActivityDetail: propOpenActivity,
}) => {
  const [activities, setActivities] = useState<ScheduleActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDiscipline, setSelectedDiscipline] = useState<string>(initialDiscipline || 'all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [locationFilter, setLocationFilter] = useState<string>('all');
  const [internalSelectedActivity, setInternalSelectedActivity] = useState<ScheduleActivity | null>(null);
  const toast = useToast();

  const handleOpenActivity = (act: ScheduleActivity) => {
    if (propOpenActivity) {
      propOpenActivity(act);
    } else {
      setInternalSelectedActivity(act);
    }
  };

  const fetchActivities = async () => {
    try {
      setLoading(true);
      const res = await api.getActivities(selectedDiscipline !== 'all' ? selectedDiscipline : undefined);
      setActivities(res.activities);
    } catch (err: any) {
      console.error('Failed to load schedule activities:', err);
      toast.error(`Failed to load schedule activities: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (initialDiscipline !== undefined) {
      setSelectedDiscipline(initialDiscipline);
    }
  }, [initialDiscipline]);

  useEffect(() => {
    fetchActivities();
  }, [selectedDiscipline]);

  // Unique locations from loaded activities
  const locations = Array.from(new Set(activities.map((a) => a.location).filter(Boolean))) as string[];

  const filtered = activities.filter((act) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      act.activity_id.toLowerCase().includes(q) ||
      act.description.toLowerCase().includes(q) ||
      act.wbs.toLowerCase().includes(q) ||
      (act.location && act.location.toLowerCase().includes(q));

    const matchesStatus = selectedStatus === 'all' || act.status === selectedStatus;
    const matchesLocation = locationFilter === 'all' || act.location === locationFilter;

    return matchesSearch && matchesStatus && matchesLocation;
  });

  return (
    <div>
      <div className="top-header">
        <div className="header-title-group">
          <h1>L5/L6 Schedule Baseline Explorer</h1>
          <p>Hierarchical Work Breakdown Structure (WBS) activities, planned milestones, and discipline categorization</p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button type="button" className="btn btn-secondary" onClick={fetchActivities} disabled={loading}>
            <RotateCw size={16} className={loading ? 'spin' : ''} />
            <span>Refresh Baseline</span>
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
              placeholder="Search by Activity ID, description, WBS, or location..."
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

          {/* Discipline selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Filter size={16} color="var(--text-muted)" />
            <select
              value={selectedDiscipline}
              onChange={(e) => setSelectedDiscipline(e.target.value)}
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
          </div>

          {/* Status selector */}
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
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
            <option value="not_started">Not Started</option>
            <option value="in_progress">In Progress</option>
            <option value="completed">Completed</option>
            <option value="delayed">Delayed</option>
          </select>

          {/* Location selector */}
          {locations.length > 0 && (
            <select
              value={locationFilter}
              onChange={(e) => setLocationFilter(e.target.value)}
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
              <option value="all">All Locations</option>
              {locations.map((loc) => (
                <option key={loc} value={loc}>
                  {loc}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* Schedule Table */}
      <div className="glass-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Layers size={18} color="var(--accent-cyan)" />
            <span style={{ fontWeight: 700, fontSize: '0.95rem', color: '#fff' }}>
              {filtered.length} Schedule Activities
            </span>
          </div>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            Click any row to open Activity Detail Drawer with AI match provenance & audit trail
          </span>
        </div>

        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Activity ID</th>
                <th>WBS Code</th>
                <th>Discipline</th>
                <th>Activity Description</th>
                <th>Location</th>
                <th>Planned Start</th>
                <th>Planned Finish</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length > 0 ? (
                filtered.map((act) => {
                  const isCompleted = act.status === 'completed';
                  const isInProgress = act.status === 'in_progress';
                  const isDelayed = act.status === 'delayed';

                  return (
                    <tr
                      key={act.activity_id}
                      className="clickable-row"
                      onClick={() => handleOpenActivity(act)}
                      style={{ cursor: 'pointer' }}
                    >
                      <td className="mono" style={{ color: 'var(--accent-cyan)', fontWeight: 700 }}>
                        {act.activity_id}
                      </td>
                      <td className="mono" style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                        {act.wbs}
                      </td>
                      <td>
                        <span className="badge badge-discipline">{act.discipline}</span>
                      </td>
                      <td style={{ maxWidth: '320px', fontWeight: 500 }}>
                        {act.description}
                      </td>
                      <td style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                        {act.location || '—'}
                      </td>
                      <td className="mono" style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                        {act.planned_start || '—'}
                      </td>
                      <td className="mono" style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                        {act.planned_finish || '—'}
                      </td>
                      <td>
                        <span
                          className={`badge ${
                            isCompleted
                              ? 'badge-high'
                              : isDelayed
                              ? 'badge-low'
                              : isInProgress
                              ? 'badge-medium'
                              : 'badge-neutral'
                          }`}
                          style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                        >
                          {isCompleted && <CheckCircle2 size={12} />}
                          {isInProgress && <Clock size={12} />}
                          {isDelayed && <AlertTriangle size={12} />}
                          <span style={{ textTransform: 'capitalize' }}>{act.status.replace('_', ' ')}</span>
                        </span>
                      </td>
                      <td>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '2px', color: 'var(--accent-cyan)', fontSize: '0.75rem', fontWeight: 600 }}>
                          Inspect <ArrowUpRight size={12} />
                        </span>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={9} style={{ textAlign: 'center', padding: '36px', color: 'var(--text-muted)' }}>
                    {loading
                      ? 'Loading schedule activities...'
                      : searchQuery || selectedDiscipline !== 'all' || selectedStatus !== 'all'
                      ? 'No activities match your search filters.'
                      : 'No activities loaded yet. Upload schedule baseline in Data Ingestion.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Internal Activity Detail Drawer */}
      {internalSelectedActivity && (
        <ActivityDetailDrawer
          activity={internalSelectedActivity}
          onClose={() => setInternalSelectedActivity(null)}
        />
      )}
    </div>
  );
};
