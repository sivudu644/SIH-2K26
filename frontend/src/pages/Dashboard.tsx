import React, { useEffect, useState } from 'react';
import {
  Layers,
  FileCheck2,
  GitMerge,
  Target,
  Clock,
  AlertTriangle,
  Play,
  RotateCw,
  Search,
  ArrowUpRight,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import { api } from '../api/client';
import { DashboardData, ScheduleActivity } from '../types';
import { StatsCard } from '../components/StatsCard';
import { useToast } from '../components/ToastContext';
import { ActivityDetailDrawer } from '../components/ActivityDetailDrawer';

const PIE_COLORS = ['#10b981', '#f59e0b', '#f43f5e'];

interface Props {
  onNavigateToPage?: (page: string, filter?: { status?: string; discipline?: string }) => void;
  onNavigateToReview?: () => void;
  onOpenActivityDetail?: (activity: ScheduleActivity) => void;
}

export const Dashboard: React.FC<Props> = ({
  onNavigateToPage: propNavigate,
  onNavigateToReview,
  onOpenActivityDetail: propOpenActivity,
}) => {
  const [internalSelectedActivity, setInternalSelectedActivity] = useState<ScheduleActivity | null>(null);

  const onNavigateToPage = (page: string, filter?: any) => {
    if (page === 'review' && onNavigateToReview) {
      onNavigateToReview();
    } else if (propNavigate) {
      propNavigate(page, filter);
    }
  };

  const onOpenActivityDetail = (activity: ScheduleActivity) => {
    if (propOpenActivity) {
      propOpenActivity(activity);
    } else {
      setInternalSelectedActivity(activity);
    }
  };
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [matchingRunning, setMatchingRunning] = useState(false);
  const [tableSearch, setTableSearch] = useState('');
  const [tableDiscipline, setTableDiscipline] = useState('all');
  const toast = useToast();

  const fetchDashboard = async () => {
    try {
      setLoading(true);
      setErrorMsg(null);
      const res = await api.getDashboard();
      setData(res);
    } catch (err: any) {
      console.error('Failed to load dashboard:', err);
      setErrorMsg(err.message || 'Unable to connect to the backend.');
      toast.error('Unable to connect to the backend. Check that the FastAPI server is running on port 8000.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, []);

  const handleRunMatching = async () => {
    try {
      setMatchingRunning(true);
      const res = await api.runMatching();
      toast.success(
        `Matching completed: ${res.auto_matched} auto-matched, ${res.review_required} review required, ${res.unmatched} unmatched.`
      );
      await fetchDashboard();
    } catch (err: any) {
      toast.error(`Matching error: ${err.message}`);
    } finally {
      setMatchingRunning(false);
    }
  };

  if (loading && !data) {
    return (
      <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-secondary)' }}>
        <RotateCw size={36} className="spin" style={{ margin: '0 auto 16px', color: 'var(--accent-cyan)' }} />
        <div style={{ fontSize: '1.05rem', fontWeight: 600, color: '#fff' }}>Connecting to Schedule-Linking Backend...</div>
        <div style={{ fontSize: '0.825rem', color: 'var(--text-muted)', marginTop: '4px' }}>Loading L5/L6 baseline activities and captured execution events</div>
      </div>
    );
  }

  if (errorMsg && !data) {
    return (
      <div className="glass-card" style={{ margin: '40px auto', maxWidth: '600px', textAlign: 'center', padding: '40px' }}>
        <AlertTriangle size={48} color="#f43f5e" style={{ margin: '0 auto 16px' }} />
        <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#fff', marginBottom: '8px' }}>Backend Connection Issue</h2>
        <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '20px' }}>
          {errorMsg}
        </p>
        <button type="button" className="btn btn-primary" onClick={fetchDashboard}>
          <RotateCw size={16} />
          <span>Retry Connection</span>
        </button>
      </div>
    );
  }

  const stats = data || {
    total_activities: 0,
    total_events: 0,
    matched_events: 0,
    avg_confidence: 0,
    review_queue_count: 0,
    unmatched_count: 0,
    discipline_progress: [],
    confidence_distribution: [],
    recent_audits: [],
    planned_vs_actual: [],
  };

  const filteredTable = stats.planned_vs_actual.filter((item) => {
    const q = tableSearch.toLowerCase();
    const matchQ =
      item.activity_id.toLowerCase().includes(q) ||
      item.description.toLowerCase().includes(q) ||
      item.discipline.toLowerCase().includes(q) ||
      (item.variance && item.variance.toLowerCase().includes(q));
    const matchDisc = tableDiscipline === 'all' || item.discipline.toLowerCase() === tableDiscipline.toLowerCase();
    return matchQ && matchDisc;
  });

  return (
    <div>
      {/* Top Header */}
      <div className="top-header">
        <div className="header-title-group">
          <h1>Infrastructure Schedule-Linking Command Center</h1>
          <p>Real-time heterogeneous progress capture & L5/L6 baseline activity linkage</p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={fetchDashboard}
            disabled={loading}
          >
            <RotateCw size={16} className={loading ? 'spin' : ''} />
            <span>Refresh</span>
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleRunMatching}
            disabled={matchingRunning}
          >
            <Play size={16} />
            <span>{matchingRunning ? 'Running Matching...' : 'Run AI Matching'}</span>
          </button>
        </div>
      </div>

      {/* Interactive Stats Cards Grid */}
      <div className="stats-grid">
        <div
          onClick={() => onNavigateToPage('explorer')}
          style={{ cursor: 'pointer' }}
          title="Click to explore L5/L6 schedule activities"
        >
          <StatsCard
            title="Schedule Activities"
            value={stats.total_activities}
            subtitle="L5/L6 baseline activities (Click to view)"
            icon={Layers}
            color="cyan"
          />
        </div>

        <div
          onClick={() => onNavigateToPage('events')}
          style={{ cursor: 'pointer' }}
          title="Click to view all captured progress events"
        >
          <StatsCard
            title="Progress Events"
            value={stats.total_events}
            subtitle="Extracted field updates (Click to view)"
            icon={FileCheck2}
            color="indigo"
          />
        </div>

        <div
          onClick={() => onNavigateToPage('events', { status: 'matched' })}
          style={{ cursor: 'pointer' }}
          title="Click to view matched progress events"
        >
          <StatsCard
            title="Matched Activities"
            value={stats.matched_events}
            subtitle={`${stats.total_events > 0 ? Math.round((stats.matched_events / stats.total_events) * 100) : 0}% linkage rate`}
            icon={GitMerge}
            color="emerald"
          />
        </div>

        <div
          onClick={() => onNavigateToPage('review')}
          style={{ cursor: 'pointer' }}
          title="Click to inspect matching confidence"
        >
          <StatsCard
            title="Average Confidence"
            value={`${Math.round(stats.avg_confidence * 100)}%`}
            subtitle="Multi-signal similarity index"
            icon={Target}
            color="blue"
          />
        </div>

        <div
          onClick={() => onNavigateToPage('review', { status: 'pending' })}
          style={{ cursor: 'pointer' }}
          title="Click to open Review Queue"
        >
          <StatsCard
            title="Review Queue"
            value={stats.review_queue_count}
            subtitle="Uncertain / Ambiguous [0.65 - 0.84]"
            icon={Clock}
            color="amber"
          />
        </div>

        <div
          onClick={() => onNavigateToPage('events', { status: 'unmatched' })}
          style={{ cursor: 'pointer' }}
          title="Click to view unmatched events"
        >
          <StatsCard
            title="Unmatched Events"
            value={stats.unmatched_count}
            subtitle="Similarity < 0.65 (Flagged)"
            icon={AlertTriangle}
            color="rose"
          />
        </div>
      </div>

      {/* Visualizations Row with Interactive Chart Clicks */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(440px, 1fr))', gap: '24px', marginBottom: '28px' }}>
        {/* Discipline Progress Chart */}
        <div className="glass-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#fff' }}>
              Discipline-wise Activity Coverage
            </h3>
            <span style={{ fontSize: '0.75rem', color: 'var(--accent-cyan)' }}>Click bar to filter explorer</span>
          </div>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '16px' }}>
            Total scheduled activities vs verified execution progress events
          </p>
          <div style={{ width: '100%', height: 260 }}>
            {stats.discipline_progress.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={stats.discipline_progress}
                  margin={{ top: 10, right: 20, left: -10, bottom: 0 }}
                  onClick={(e: any) => {
                    if (e && e.activePayload && e.activePayload[0]) {
                      const disc = e.activePayload[0].payload.discipline;
                      onNavigateToPage('explorer', { discipline: disc.toLowerCase() });
                    }
                  }}
                  style={{ cursor: 'pointer' }}
                >
                  <XAxis dataKey="discipline" stroke="#9ca3af" tick={{ fill: '#9ca3af', fontSize: 12 }} />
                  <YAxis stroke="#9ca3af" tick={{ fill: '#9ca3af', fontSize: 12 }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1f2937',
                      borderColor: 'rgba(255,255,255,0.1)',
                      borderRadius: 8,
                      color: '#fff',
                    }}
                  />
                  <Bar dataKey="total_activities" name="Total Baseline" fill="#38bdf8" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="matched_events" name="Matched Progress" fill="#10b981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)' }}>
                No discipline progress data available yet. Ingest schedule in Data Ingestion.
              </div>
            )}
          </div>
        </div>

        {/* Confidence Distribution Chart */}
        <div className="glass-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#fff' }}>
              Match Confidence Distribution
            </h3>
            <span style={{ fontSize: '0.75rem', color: 'var(--accent-amber)' }}>Click slice to view queue</span>
          </div>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '16px' }}>
            Breakdown across policy thresholds (Auto ≥85%, Review 65-84%, Low &lt;65%)
          </p>
          <div style={{ width: '100%', height: 260 }}>
            {stats.confidence_distribution.some((d) => d.count > 0) ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={stats.confidence_distribution}
                    dataKey="count"
                    nameKey="range"
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={4}
                    onClick={(entry: any) => {
                      if (entry.range.includes('Review')) {
                        onNavigateToPage('review');
                      } else if (entry.range.includes('Low') || entry.range.includes('Unmatched')) {
                        onNavigateToPage('events', { status: 'unmatched' });
                      } else {
                        onNavigateToPage('events', { status: 'matched' });
                      }
                    }}
                    style={{ cursor: 'pointer' }}
                  >
                    {stats.confidence_distribution.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1f2937',
                      borderColor: 'rgba(255,255,255,0.1)',
                      borderRadius: 8,
                      color: '#fff',
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: '12px', color: '#9ca3af' }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)' }}>
                Upload progress events and run matching to see distribution.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Planned vs Actual Activity Tracking Table */}
      <div className="glass-card" style={{ marginBottom: '28px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#fff' }}>
              Planned vs Actual Schedule Linkages & Variances
            </h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              Click any row to open the Activity Detail Drawer with complete schedule baseline & audit logs
            </p>
          </div>

          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <div style={{ position: 'relative', width: '220px' }}>
              <Search size={15} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                type="text"
                placeholder="Search activities..."
                value={tableSearch}
                onChange={(e) => setTableSearch(e.target.value)}
                style={{
                  width: '100%',
                  backgroundColor: 'var(--bg-input)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)',
                  padding: '7px 10px 7px 32px',
                  color: '#fff',
                  fontSize: '0.8rem',
                  outline: 'none',
                }}
              />
            </div>

            <select
              value={tableDiscipline}
              onChange={(e) => setTableDiscipline(e.target.value)}
              style={{
                backgroundColor: 'var(--bg-input)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
                padding: '7px 12px',
                color: '#fff',
                fontSize: '0.8rem',
                outline: 'none',
              }}
            >
              <option value="all">All Disciplines</option>
              <option value="piping">Piping</option>
              <option value="civil">Civil</option>
              <option value="electrical">Electrical</option>
            </select>
          </div>
        </div>

        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Activity ID</th>
                <th>Discipline</th>
                <th>Description</th>
                <th>Planned Dates</th>
                <th>Actual Dates</th>
                <th>Linked Events</th>
                <th>Schedule Variance</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredTable.length > 0 ? (
                filteredTable.map((item, idx) => {
                  const isDelayed = item.variance?.includes('Delay');
                  const isEarly = item.variance?.includes('Early');
                  const isOnTrack = item.variance?.includes('On Track') || item.variance?.includes('On Schedule');
                  const isCompleted = item.variance === 'Completed' || item.schedule_status === 'completed';

                  const actObj: ScheduleActivity = {
                    activity_id: item.activity_id,
                    wbs: item.activity_id,
                    discipline: item.discipline,
                    description: item.description,
                    planned_start: item.planned_start,
                    planned_finish: item.planned_finish,
                    status: item.schedule_status || 'not_started',
                  };

                  return (
                    <tr
                      key={idx}
                      onClick={() => onOpenActivityDetail(actObj)}
                      style={{ cursor: 'pointer' }}
                    >
                      <td className="mono" style={{ color: 'var(--accent-cyan)', fontWeight: 700 }}>
                        {item.activity_id}
                      </td>
                      <td>
                        <span className="badge badge-discipline">{item.discipline}</span>
                      </td>
                      <td style={{ maxWidth: '280px', fontWeight: 500 }}>{item.description}</td>
                      <td className="mono" style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                        {item.planned_start || '—'} → {item.planned_finish || '—'}
                      </td>
                      <td className="mono" style={{ fontSize: '0.78rem', color: item.actual_start ? '#34d399' : 'var(--text-muted)' }}>
                        {item.actual_start || 'Pending'} {item.actual_finish ? `→ ${item.actual_finish}` : ''}
                      </td>
                      <td className="mono" style={{ fontSize: '0.8rem', textAlign: 'center' }}>
                        {item.linked_events_count ? (
                          <span className="badge badge-neutral" style={{ color: '#38bdf8' }}>
                            {item.linked_events_count} event{item.linked_events_count > 1 ? 's' : ''}
                          </span>
                        ) : (
                          '0'
                        )}
                      </td>
                      <td>
                        <span
                          className={`badge ${
                            isCompleted
                              ? 'badge-high'
                              : isDelayed
                              ? 'badge-low'
                              : isEarly
                              ? 'badge-high'
                              : isOnTrack
                              ? 'badge-high'
                              : 'badge-neutral'
                          }`}
                        >
                          {item.variance || 'Pending Start'}
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
                  <td colSpan={8} style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>
                    {tableSearch || tableDiscipline !== 'all'
                      ? 'No activities match your current search/filter.'
                      : 'No activities loaded yet. Upload schedule baseline in Data Ingestion.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Live System Audit Trail */}
      <div className="glass-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#fff' }}>
              Live System Audit Trail
            </h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              Cryptographically timestamped record of schedule imports, parsing, matches, and approvals
            </p>
          </div>
        </div>

        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Action</th>
                <th>Entity</th>
                <th>Details</th>
                <th>Actor</th>
              </tr>
            </thead>
            <tbody>
              {stats.recent_audits && stats.recent_audits.length > 0 ? (
                stats.recent_audits.map((log) => (
                  <tr key={log.audit_id}>
                    <td className="mono" style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                      {log.timestamp.slice(0, 19).replace('T', ' ')}
                    </td>
                    <td>
                      <span className="badge badge-neutral" style={{ textTransform: 'uppercase', fontSize: '0.7rem' }}>
                        {log.action}
                      </span>
                    </td>
                    <td className="mono" style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      {log.entity_type} {log.entity_id ? `(${log.entity_id.slice(0, 8)})` : ''}
                    </td>
                    <td style={{ fontSize: '0.85rem' }}>{log.details || '—'}</td>
                    <td>
                      <span className="badge badge-neutral">{log.user}</span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>
                    No audit records logged yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Activity Detail Drawer */}
      {internalSelectedActivity && (
        <ActivityDetailDrawer
          activity={internalSelectedActivity}
          onClose={() => setInternalSelectedActivity(null)}
        />
      )}
    </div>
  );
};
