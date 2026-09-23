import React, { useEffect, useState } from 'react';
import { BrainCircuit, BookOpen, GitCompare, CheckCircle2, RotateCw, Search } from 'lucide-react';
import { api } from '../api/client';
import { ConfidenceBadge } from '../components/ConfidenceBadge';

export const InstitutionalMemory: React.FC = () => {
  const [memoryData, setMemoryData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchLexicon, setSearchLexicon] = useState('');
  const [searchLinks, setSearchLinks] = useState('');

  const fetchMemory = async () => {
    try {
      setLoading(true);
      const res = await api.getMemory();
      setMemoryData(res);
    } catch (err) {
      console.error('Failed to load memory:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMemory();
  }, []);

  const stats = memoryData?.stats || {
    total_matches_evaluated: 0,
    auto_matches: 0,
    human_approved: 0,
    human_rejected: 0,
    mean_confidence: 0,
  };

  const filteredLexicon = (memoryData?.terminology_lexicon || []).filter((item: any) => {
    const q = searchLexicon.toLowerCase();
    return (
      item.alias?.toLowerCase().includes(q) ||
      item.canonical?.toLowerCase().includes(q) ||
      item.discipline?.toLowerCase().includes(q)
    );
  });

  const filteredLinks = (memoryData?.historical_learned_links || []).filter((link: any) => {
    const q = searchLinks.toLowerCase();
    return (
      link.activity_id?.toLowerCase().includes(q) ||
      link.act_desc?.toLowerCase().includes(q) ||
      link.event_text?.toLowerCase().includes(q)
    );
  });

  return (
    <div>
      <div className="top-header">
        <div className="header-title-group">
          <h1>Institutional Memory & Ontology Graph</h1>
          <p>Continuous learning repository, project domain terminology lexicon, and historical match provenance</p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button type="button" className="btn btn-secondary" onClick={fetchMemory} disabled={loading}>
            <RotateCw size={16} className={loading ? 'spin' : ''} />
            <span>Refresh Knowledge Graph</span>
          </button>
        </div>
      </div>

      {/* Stats row */}
      <div className="stats-grid" style={{ marginBottom: '28px' }}>
        <div className="stat-card cyan">
          <div className="stat-header">
            <span className="stat-title">Matches Evaluated</span>
            <BrainCircuit size={20} color="#22d3ee" />
          </div>
          <div className="stat-value">{stats.total_matches_evaluated}</div>
          <div className="stat-sub">Across all project phases</div>
        </div>

        <div className="stat-card emerald">
          <div className="stat-header">
            <span className="stat-title">Auto-Matched Linkages</span>
            <CheckCircle2 size={20} color="#34d399" />
          </div>
          <div className="stat-value">{stats.auto_matches}</div>
          <div className="stat-sub">High-confidence &ge;85% links</div>
        </div>

        <div className="stat-card indigo">
          <div className="stat-header">
            <span className="stat-title">Human Supervised Matches</span>
            <GitCompare size={20} color="#818cf8" />
          </div>
          <div className="stat-value">{stats.human_approved}</div>
          <div className="stat-sub">Review-queue approvals</div>
        </div>

        <div className="stat-card amber">
          <div className="stat-header">
            <span className="stat-title">Mean Confidence Index</span>
            <BookOpen size={20} color="#fbbf24" />
          </div>
          <div className="stat-value">{(stats.mean_confidence * 100).toFixed(1)}%</div>
          <div className="stat-sub">Multi-signal accuracy</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: '24px', marginBottom: '28px' }}>
        {/* Domain Terminology Lexicon */}
        <div className="glass-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <BookOpen size={18} color="#06b6d4" />
              Infrastructure Engineering Domain Lexicon
            </h3>
            <span className="badge badge-neutral">{filteredLexicon.length} Terms</span>
          </div>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '16px' }}>
            Active abbreviation-to-canonical term mapping dictionary used in multi-signal semantic matching
          </p>

          <div style={{ position: 'relative', marginBottom: '14px' }}>
            <Search size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text"
              placeholder="Filter domain terms (e.g. spool, NDT, tie-in)..."
              value={searchLexicon}
              onChange={(e) => setSearchLexicon(e.target.value)}
              style={{
                width: '100%',
                backgroundColor: 'var(--bg-input)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
                padding: '7px 10px 7px 34px',
                color: '#fff',
                fontSize: '0.8rem',
                outline: 'none',
              }}
            />
          </div>

          <div style={{ maxHeight: '340px', overflowY: 'auto', paddingRight: '6px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '10px' }}>
              {filteredLexicon.map((item: any, idx: number) => (
                <div
                  key={idx}
                  style={{
                    backgroundColor: 'rgba(31, 41, 55, 0.6)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-md)',
                    padding: '10px 12px',
                  }}
                >
                  <div className="mono" style={{ color: 'var(--accent-cyan)', fontWeight: 700, fontSize: '0.85rem' }}>
                    {item.alias?.toUpperCase()}
                  </div>
                  <div style={{ color: 'var(--text-secondary)', fontSize: '0.78rem', marginTop: '2px' }}>
                    &rarr; {item.canonical}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Historical Learned Links */}
        <div className="glass-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <BrainCircuit size={18} color="#10b981" />
              Learned Semantic Activity Alignments
            </h3>
            <span className="badge badge-neutral">{filteredLinks.length} Links</span>
          </div>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '16px' }}>
            Verified links retained in institutional memory to accelerate future matching passes
          </p>

          <div style={{ position: 'relative', marginBottom: '14px' }}>
            <Search size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text"
              placeholder="Search learned linkages by activity or event..."
              value={searchLinks}
              onChange={(e) => setSearchLinks(e.target.value)}
              style={{
                width: '100%',
                backgroundColor: 'var(--bg-input)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
                padding: '7px 10px 7px 34px',
                color: '#fff',
                fontSize: '0.8rem',
                outline: 'none',
              }}
            />
          </div>

          <div style={{ maxHeight: '340px', overflowY: 'auto' }}>
            {filteredLinks.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {filteredLinks.map((link: any, idx: number) => (
                  <div
                    key={idx}
                    style={{
                      backgroundColor: 'rgba(31, 41, 55, 0.6)',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius-md)',
                      padding: '12px',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                      <span className="mono" style={{ color: 'var(--accent-cyan)', fontWeight: 700, fontSize: '0.8rem' }}>
                        {link.activity_id}
                      </span>
                      <ConfidenceBadge confidence={link.confidence_score} />
                    </div>
                    <div style={{ fontSize: '0.825rem', color: '#f3f4f6', fontWeight: 600 }}>
                      {link.act_desc}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                      Event: "{link.event_text?.slice(0, 70)}..."
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '40px 16px', color: 'var(--text-muted)' }}>
                No learned matches recorded matching search query. Run matching or approve items in the review queue.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
