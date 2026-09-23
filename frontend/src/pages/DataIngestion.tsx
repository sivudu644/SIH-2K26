import React, { useState } from 'react';
import { api } from '../api/client';
import { FileUpload } from '../components/FileUpload';
import {
  Sparkles,
  CheckCircle2,
  Layers,
  FileCheck,
  AlertTriangle,
  RotateCw,
  ListFilter,
} from 'lucide-react';
import { useToast } from '../components/ToastContext';

interface IngestionPipelineStage {
  name: string;
  key: 'upload' | 'parse' | 'extract' | 'normalize' | 'match' | 'review' | 'confirm' | 'schedule_update';
  status: 'pending' | 'running' | 'completed' | 'warning' | 'error';
  detail?: string;
}

interface IngestionResult {
  source: string;
  discipline: string;
  type: 'schedule' | 'progress';
  recordsProcessed: number;
  recordsAccepted: number;
  matchedCount?: number;
  reviewCount?: number;
  unmatchedCount?: number;
  timestamp: string;
}

interface Props {
  onNavigateToPage?: (page: string, filter?: { status?: string; discipline?: string }) => void;
  onNavigateToMatching?: () => void;
}

export const DataIngestion: React.FC<Props> = ({ onNavigateToPage: propNavigate, onNavigateToMatching }) => {
  const onNavigateToPage = (page: string, filter?: any) => {
    if (page === 'dashboard' && onNavigateToMatching) {
      onNavigateToMatching();
    } else if (propNavigate) {
      propNavigate(page, filter);
    }
  };

  const [pipelineStages, setPipelineStages] = useState<IngestionPipelineStage[]>([
    { name: 'UPLOAD', key: 'upload', status: 'pending', detail: 'Awaiting source file' },
    { name: 'PARSE', key: 'parse', status: 'pending', detail: 'CSV/XLSX/TXT structural parsing' },
    { name: 'EXTRACT', key: 'extract', status: 'pending', detail: 'Entity & time boundary extraction' },
    { name: 'NORMALIZE', key: 'normalize', status: 'pending', detail: 'Synonym & domain expansion' },
    { name: 'MATCH', key: 'match', status: 'pending', detail: '5-signal similarity computation' },
    { name: 'REVIEW', key: 'review', status: 'pending', detail: 'HITL routing [0.65 - 0.84]' },
    { name: 'CONFIRM', key: 'confirm', status: 'pending', detail: 'Auto-link ≥85% or human verify' },
    { name: 'SCHEDULE UPDATE', key: 'schedule_update', status: 'pending', detail: 'L5/L6 actuals & variance' },
  ]);

  const [activeResult, setActiveResult] = useState<IngestionResult | null>(null);
  const [processing, setProcessing] = useState(false);
  const toast = useToast();

  const updateStage = (key: string, status: IngestionPipelineStage['status'], detail?: string) => {
    setPipelineStages((prev) =>
      prev.map((s) => (s.key === key ? { ...s, status, detail: detail || s.detail } : s))
    );
  };

  const resetPipeline = () => {
    setPipelineStages([
      { name: 'UPLOAD', key: 'upload', status: 'running', detail: 'File received by server' },
      { name: 'PARSE', key: 'parse', status: 'pending', detail: 'Structural parser' },
      { name: 'EXTRACT', key: 'extract', status: 'pending', detail: 'Entity extraction' },
      { name: 'NORMALIZE', key: 'normalize', status: 'pending', detail: 'Domain expansion' },
      { name: 'MATCH', key: 'match', status: 'pending', detail: 'Multi-signal AI engine' },
      { name: 'REVIEW', key: 'review', status: 'pending', detail: 'Confidence routing' },
      { name: 'CONFIRM', key: 'confirm', status: 'pending', detail: 'Schedule actuals commit' },
      { name: 'SCHEDULE UPDATE', key: 'schedule_update', status: 'pending', detail: 'Variance tracking' },
    ]);
  };

  const handleScheduleUpload = async (file: File) => {
    try {
      setProcessing(true);
      resetPipeline();
      updateStage('upload', 'completed', `File: ${file.name}`);
      updateStage('parse', 'running', 'Parsing schedule CSV/XLSX...');

      const formData = new FormData();
      formData.append('file', file);
      const res = await api.uploadSchedule(formData);

      updateStage('parse', 'completed', `Validated ${res.activities_imported} activities`);
      updateStage('extract', 'completed', `${res.activities_imported} WBS elements structured`);
      updateStage('normalize', 'completed', 'Activity taxonomy mapped');
      updateStage('schedule_update', 'completed', `Baseline loaded (${res.activities_imported} items)`);

      setActiveResult({
        source: file.name,
        discipline: 'multi-discipline',
        type: 'schedule',
        recordsProcessed: res.activities_imported,
        recordsAccepted: res.activities_imported,
        timestamp: new Date().toLocaleTimeString(),
      });

      toast.success(`Successfully imported ${res.activities_imported} baseline activities from ${file.name}`);
    } catch (err: any) {
      updateStage('parse', 'error', err.message);
      toast.error(`Schedule upload failed: ${err.message}`);
    } finally {
      setProcessing(false);
    }
  };

  const handleLoadSampleSchedule = async () => {
    const sampleScheduleData = `activity_id,wbs,discipline,description,planned_start,planned_finish,location,status
PIP-001,1.1.1,piping,8 inch carbon steel pipe spool fabrication,2026-07-01,2026-08-15,Fab Yard Area A,in_progress
PIP-002,1.1.2,piping,6 inch stainless steel pipe installation - Unit 100,2026-07-15,2026-09-01,Unit 100 - Rack R1,not_started
PIP-003,1.1.3,piping,Hydrostatic pressure testing of piping circuit PC-101,2026-09-05,2026-09-20,Unit 100,not_started
PIP-004,1.1.4,piping,Weld joint completion for header H-201,2026-07-10,2026-08-30,Unit 200 - Header Area,in_progress
PIP-005,1.1.5,piping,Pipe support installation at pipe rack PR-01,2026-08-01,2026-09-15,Pipe Rack PR-01,not_started
PIP-006,1.1.6,piping,Flange bolt-up and gasket installation line L-301,2026-09-01,2026-10-01,Unit 300,not_started
PIP-007,1.1.7,piping,Insulation work on hot piping circuits,2026-09-15,2026-10-30,Units 100-300,not_started
PIP-008,1.1.8,piping,4 inch utility piping installation - firewater,2026-07-20,2026-09-10,Utility Area,in_progress
PIP-009,1.1.9,piping,Valve installation and tagging for Unit 200,2026-08-15,2026-09-30,Unit 200,not_started
PIP-010,1.2.1,piping,Pigging and flushing of process lines,2026-10-01,2026-10-20,All Units,not_started
CIV-001,2.1.1,civil,Reinforced concrete foundation for compressor C-101,2026-06-15,2026-08-01,Compressor Area,in_progress
CIV-002,2.1.2,civil,Earthwork and excavation for Unit 200 foundations,2026-06-20,2026-07-30,Unit 200 Plot,in_progress
CIV-003,2.1.3,civil,Piling work for heavy equipment foundation,2026-07-01,2026-08-15,Equipment Area EA-1,not_started
CIV-004,2.1.4,civil,Underground cable trench construction,2026-07-15,2026-09-01,Main Cable Route,not_started
CIV-005,2.1.5,civil,Control room building structural steelwork,2026-08-01,2026-10-15,Control Room Area,not_started
CIV-006,2.1.6,civil,Pipe rack foundation and pedestal construction,2026-06-25,2026-08-20,Pipe Rack PR-01,in_progress
CIV-007,2.1.7,civil,Road and access way construction,2026-07-10,2026-09-15,Plant Access Roads,not_started
CIV-008,2.1.8,civil,Fireproofing application on steel structures,2026-09-01,2026-10-30,All Units,not_started
CIV-009,2.1.9,civil,Boundary wall and fencing installation,2026-08-15,2026-10-01,Plant Boundary,not_started
CIV-010,2.2.1,civil,Storm water drainage system construction,2026-07-20,2026-09-30,Plant Wide,not_started
ELE-001,3.1.1,electrical,Main power transformer installation 33kV/6.6kV,2026-08-01,2026-09-30,Substation Area,not_started
ELE-002,3.1.2,electrical,HT cable pulling and termination 6.6kV,2026-08-15,2026-10-15,Cable Gallery CG-01,not_started
ELE-003,3.1.3,electrical,LT power cable laying for Unit 100 motors,2026-07-15,2026-09-01,Unit 100 MCC Room,not_started
ELE-004,3.1.4,electrical,Motor control center MCC-01 installation,2026-08-01,2026-09-15,MCC Room 1,not_started
ELE-005,3.1.5,electrical,Lighting installation for process area,2026-09-01,2026-10-30,Process Areas,not_started
ELE-006,3.1.6,electrical,Earthing and grounding grid installation,2026-07-01,2026-08-30,Plant Wide,in_progress
ELE-007,3.1.7,electrical,Cable tray and ladder installation,2026-07-20,2026-09-15,Cable Routes,not_started
ELE-008,3.1.8,electrical,Emergency diesel generator installation,2026-09-01,2026-10-30,DG Room,not_started
ELE-009,3.1.9,electrical,Junction box and marshalling panel installation,2026-08-15,2026-10-01,Field Junction Areas,not_started
ELE-010,3.2.1,electrical,Substation bus bar and switchgear installation,2026-08-01,2026-10-15,Main Substation,not_started
ELE-011,3.2.2,electrical,Variable frequency drive VFD installation,2026-09-15,2026-11-01,VFD Room,not_started
ELE-012,3.2.3,electrical,Fire alarm and detection system installation,2026-09-01,2026-11-15,Plant Wide,not_started`;

    const blob = new Blob([sampleScheduleData], { type: 'text/csv' });
    const file = new File([blob], 'synthetic_l5_schedule.csv', { type: 'text/csv' });
    await handleScheduleUpload(file);
  };

  const handleProgressUpload = async (file: File, disciplineHint: string = 'general') => {
    try {
      setProcessing(true);
      resetPipeline();
      updateStage('upload', 'completed', `File: ${file.name}`);
      updateStage('parse', 'running', 'Extracting execution events...');

      const formData = new FormData();
      formData.append('file', file);
      const res = await api.uploadProgress(formData);

      updateStage('parse', 'completed', `${res.events_extracted} raw statements parsed`);
      updateStage('extract', 'completed', `${res.events_extracted} events extracted`);
      updateStage('normalize', 'completed', 'Domain synonyms expanded');
      updateStage('match', 'running', 'Running multi-signal matching engine...');

      const matchRes = await api.runMatching();

      updateStage('match', 'completed', `${matchRes.auto_matched} auto-matched`);
      if (matchRes.review_required > 0) {
        updateStage('review', 'warning', `${matchRes.review_required} review required`);
      } else {
        updateStage('review', 'completed', 'Queue clear');
      }
      if (matchRes.unmatched > 0) {
        updateStage('confirm', 'warning', `${matchRes.unmatched} unmatched events`);
      } else {
        updateStage('confirm', 'completed', 'All linked');
      }
      updateStage('schedule_update', 'completed', 'Schedule actuals synchronized');

      setActiveResult({
        source: file.name,
        discipline: disciplineHint,
        type: 'progress',
        recordsProcessed: res.events_extracted,
        recordsAccepted: res.events_extracted,
        matchedCount: matchRes.auto_matched,
        reviewCount: matchRes.review_required,
        unmatchedCount: matchRes.unmatched,
        timestamp: new Date().toLocaleTimeString(),
      });

      toast.success(
        `Ingested ${res.events_extracted} events: ${matchRes.auto_matched} matched, ${matchRes.review_required} review required, ${matchRes.unmatched} unmatched.`
      );
    } catch (err: any) {
      updateStage('parse', 'error', err.message);
      toast.error(`Progress upload failed: ${err.message}`);
    } finally {
      setProcessing(false);
    }
  };

  const handleLoadSamplePipingReport = async () => {
    const pipingReport = `DAILY PROGRESS REPORT — PIPING DISCIPLINE
Project: Oil India Greenfield Expansion
Date: 2026-09-15
Prepared by: Piping Superintendent

ACTIVITIES COMPLETED / IN PROGRESS:
1. Completed fabrication of 8" CS pipe spools for Unit 100 rack area. All 24 spools released for installation. Work started on 01-Jul-2026 and finished today 15-Sep-2026.
2. Started erection of 6" SS piping at Unit 100 Pipe Rack R1. First lift completed, 35% overall progress. Actual start date: 15-Sep-2026.
3. Welding work ongoing on header H-201 area. Total 85 weld joints completed out of 120 planned. Radiography cleared for 78 joints. Started 10-Jul-2026.
4. Commenced installation of pipe supports on Rack PR-01. Approximately 40 supports out of 95 installed. Started 01-Sep-2026.
5. Firewater utility piping 4-inch line installation at utility block reached 90% completion. Expect finish by end of week. Work began 20-Jul-2026.`;

    const blob = new Blob([pipingReport], { type: 'text/plain' });
    const file = new File([blob], 'daily_report_piping.txt', { type: 'text/plain' });
    await handleProgressUpload(file, 'piping');
  };

  const handleLoadSampleCivilReport = async () => {
    const civilReport = `DAILY PROGRESS REPORT — CIVIL DISCIPLINE
Project: Oil India Greenfield Expansion
Date: 2026-09-15
Prepared by: Civil Superintendent

ACTIVITIES COMPLETED / IN PROGRESS:
1. Compressor C-101 RCC foundation — concrete pouring for second lift completed. Foundation work started 15-Jun-2026. Curing ongoing, estimated completion 20-Sep-2026.
2. Excavation at Unit 200 plot area is 95% complete. Approximately 2,800 cum of earth removed. Earthwork activity started 20-Jun-2026, expected finish by 18-Sep-2026.
3. Driven piles for heavy equipment foundation at area EA-1 — completed 45 out of 80 piles. Piling commenced 05-Jul-2026.
4. Pipe rack PR-01 pedestal construction progressing well. 12 out of 18 pedestals completed with anchor bolt installation. Work started 25-Jun-2026.`;

    const blob = new Blob([civilReport], { type: 'text/plain' });
    const file = new File([blob], 'daily_report_civil.txt', { type: 'text/plain' });
    await handleProgressUpload(file, 'civil');
  };

  const handleLoadSampleElectricalReport = async () => {
    const electricalReport = `DAILY PROGRESS REPORT — ELECTRICAL DISCIPLINE
Project: Oil India Greenfield Expansion
Date: 2026-09-15
Prepared by: Electrical Superintendent

ACTIVITIES COMPLETED / IN PROGRESS:
1. Earth grid installation across plant area — buried copper conductor laying 75% complete. Grounding work commenced 01-Jul-2026.
2. Cable tray erection along main cable route corridors — 60% of trays and ladder racks installed. Installation started 25-Jul-2026.
3. LT power cable pulling for Unit 100 area motors — 12 out of 30 cables pulled and terminated. Work started 01-Sep-2026.
4. Received 33kV/6.6kV main power transformer at site. Foundation ready, transformer positioning scheduled for next week.
5. Junction boxes installed at 15 field locations out of 40 planned. JB and marshalling panel work began 20-Aug-2026.
6. Emergency DG set foundation and civil works completed. DG equipment arrival expected next month.`;

    const blob = new Blob([electricalReport], { type: 'text/plain' });
    const file = new File([blob], 'daily_report_electrical.txt', { type: 'text/plain' });
    await handleProgressUpload(file, 'electrical');
  };

  return (
    <div>
      <div className="top-header">
        <div className="header-title-group">
          <h1>Heterogeneous Data Ingestion & Pipeline Orchestrator</h1>
          <p>Multi-source ingestion pipeline: CSV / XLSX schedule baselines & natural text site progress reports</p>
        </div>
      </div>

      {/* Visual Ingestion Pipeline */}
      <div className="glass-card" style={{ marginBottom: '28px', padding: '20px 24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Sparkles size={18} color="var(--accent-cyan)" />
            <span style={{ fontWeight: 700, fontSize: '0.95rem', color: '#fff' }}>
              INGESTION PIPELINE STAGES
            </span>
          </div>
          {processing && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--accent-cyan)', fontSize: '0.8rem' }}>
              <RotateCw size={14} className="spin" />
              <span>Processing pipeline execution...</span>
            </div>
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '8px' }}>
          {pipelineStages.map((stage, idx) => {
            const isCompleted = stage.status === 'completed';
            const isRunning = stage.status === 'running';
            const isWarning = stage.status === 'warning';
            const isError = stage.status === 'error';

            return (
              <div
                key={stage.key}
                style={{
                  backgroundColor: isCompleted
                    ? 'rgba(16, 185, 129, 0.12)'
                    : isRunning
                    ? 'rgba(6, 182, 212, 0.15)'
                    : isWarning
                    ? 'rgba(245, 158, 11, 0.12)'
                    : isError
                    ? 'rgba(244, 63, 94, 0.15)'
                    : 'rgba(31, 41, 55, 0.4)',
                  border: `1px solid ${
                    isCompleted
                      ? 'rgba(16, 185, 129, 0.4)'
                      : isRunning
                      ? 'var(--accent-cyan)'
                      : isWarning
                      ? 'rgba(245, 158, 11, 0.4)'
                      : isError
                      ? '#f43f5e'
                      : 'var(--border)'
                  }`,
                  borderRadius: 'var(--radius-md)',
                  padding: '10px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px',
                  transition: 'all 0.2s',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--text-muted)' }}>
                    {idx + 1}. {stage.name}
                  </span>
                  {isCompleted && <CheckCircle2 size={13} color="#34d399" />}
                  {isRunning && <RotateCw size={13} className="spin" color="#22d3ee" />}
                  {isWarning && <AlertTriangle size={13} color="#fbbf24" />}
                </div>
                <div style={{ fontSize: '0.725rem', color: isCompleted ? '#e2e8f0' : '#94a3b8', lineHeight: 1.3 }}>
                  {stage.detail}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Result Panel (Appears after ingestion) */}
      {activeResult && (
        <div
          className="glass-card"
          style={{
            marginBottom: '28px',
            padding: '20px 24px',
            backgroundColor: 'rgba(15, 23, 42, 0.85)',
            border: '1px solid rgba(6, 182, 212, 0.3)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                <span className="badge badge-high" style={{ fontWeight: 700 }}>
                  INGESTION SUCCESSFUL
                </span>
                <span className="badge badge-discipline">{activeResult.discipline}</span>
                <span className="mono" style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  {activeResult.timestamp}
                </span>
              </div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#fff' }}>
                Source: {activeResult.source}
              </h3>
            </div>

            {/* Quick Action Buttons */}
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => onNavigateToPage('events', { discipline: activeResult.discipline !== 'multi-discipline' ? activeResult.discipline : undefined })}
              >
                <FileCheck size={14} />
                <span>View Events</span>
              </button>
              {activeResult.reviewCount && activeResult.reviewCount > 0 ? (
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => onNavigateToPage('review')}
                  style={{ backgroundColor: 'rgba(245, 158, 11, 0.2)', color: '#fbbf24', borderColor: 'rgba(245, 158, 11, 0.4)' }}
                >
                  <ListFilter size={14} />
                  <span>View Review Queue ({activeResult.reviewCount})</span>
                </button>
              ) : null}
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => onNavigateToPage('explorer', { discipline: activeResult.discipline !== 'multi-discipline' ? activeResult.discipline : undefined })}
              >
                <Layers size={14} />
                <span>View Schedule</span>
              </button>
            </div>
          </div>

          {/* Counts Matrix */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '12px', fontSize: '0.8rem' }}>
            <div style={{ backgroundColor: 'rgba(31, 41, 55, 0.5)', padding: '10px 14px', borderRadius: 'var(--radius-md)' }}>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>Processed</div>
              <div className="mono" style={{ fontSize: '1.1rem', fontWeight: 800, color: '#fff' }}>
                {activeResult.recordsProcessed}
              </div>
            </div>
            <div style={{ backgroundColor: 'rgba(31, 41, 55, 0.5)', padding: '10px 14px', borderRadius: 'var(--radius-md)' }}>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>Accepted</div>
              <div className="mono" style={{ fontSize: '1.1rem', fontWeight: 800, color: '#34d399' }}>
                {activeResult.recordsAccepted}
              </div>
            </div>
            {activeResult.matchedCount !== undefined && (
              <div style={{ backgroundColor: 'rgba(31, 41, 55, 0.5)', padding: '10px 14px', borderRadius: 'var(--radius-md)' }}>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>Auto-Matched</div>
                <div className="mono" style={{ fontSize: '1.1rem', fontWeight: 800, color: '#38bdf8' }}>
                  {activeResult.matchedCount}
                </div>
              </div>
            )}
            {activeResult.reviewCount !== undefined && (
              <div style={{ backgroundColor: 'rgba(31, 41, 55, 0.5)', padding: '10px 14px', borderRadius: 'var(--radius-md)' }}>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>Review Required</div>
                <div className="mono" style={{ fontSize: '1.1rem', fontWeight: 800, color: '#fbbf24' }}>
                  {activeResult.reviewCount}
                </div>
              </div>
            )}
            {activeResult.unmatchedCount !== undefined && (
              <div style={{ backgroundColor: 'rgba(31, 41, 55, 0.5)', padding: '10px 14px', borderRadius: 'var(--radius-md)' }}>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>Unmatched</div>
                <div className="mono" style={{ fontSize: '1.1rem', fontWeight: 800, color: '#fb7185' }}>
                  {activeResult.unmatchedCount}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Upload Columns */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(440px, 1fr))', gap: '24px', marginBottom: '28px' }}>
        {/* Schedule Baseline Upload */}
        <div className="glass-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
            <div style={{ padding: '8px', borderRadius: 'var(--radius-md)', background: 'rgba(6, 182, 212, 0.15)', color: 'var(--accent-cyan)' }}>
              <Layers size={22} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#fff' }}>
                L5/L6 Schedule Baseline Ingestion
              </h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                Upload Primavera P6 / MS Project export in CSV or XLSX format
              </p>
            </div>
          </div>

          <FileUpload
            accept=".csv,.xlsx,.xls"
            title="Upload Schedule Baseline File"
            subtitle="Supports standard CSV with activity_id, wbs, discipline, description, planned_start, planned_finish, location"
            onUpload={handleScheduleUpload}
          />

          <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--border)' }}>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={handleLoadSampleSchedule}
              disabled={processing}
              style={{ width: '100%' }}
            >
              <Sparkles size={14} color="#06b6d4" />
              <span>Load Synthetic 32-Activity L5/L6 Baseline Schedule</span>
            </button>
          </div>
        </div>

        {/* Progress Reports Upload */}
        <div className="glass-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
            <div style={{ padding: '8px', borderRadius: 'var(--radius-md)', background: 'rgba(99, 102, 241, 0.15)', color: 'var(--accent-indigo)' }}>
              <FileCheck size={22} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#fff' }}>
                Heterogeneous Field Progress Ingestion
              </h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                Upload daily supervisor reports (TXT), field spreadsheets (CSV/XLSX)
              </p>
            </div>
          </div>

          <FileUpload
            accept=".csv,.xlsx,.xls,.txt"
            title="Upload Heterogeneous Field Progress Report"
            subtitle="Parses natural language reports into structured execution actuals"
            onUpload={(file: File) => handleProgressUpload(file, 'general')}
          />

          <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={handleLoadSamplePipingReport}
              disabled={processing}
              style={{ justifyContent: 'flex-start' }}
            >
              <span className="badge badge-discipline" style={{ fontSize: '0.7rem' }}>Piping</span>
              <span>Ingest Piping Daily Progress Report (5 events)</span>
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={handleLoadSampleCivilReport}
              disabled={processing}
              style={{ justifyContent: 'flex-start' }}
            >
              <span className="badge badge-discipline" style={{ fontSize: '0.7rem' }}>Civil</span>
              <span>Ingest Civil Daily Progress Report (4 events)</span>
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={handleLoadSampleElectricalReport}
              disabled={processing}
              style={{ justifyContent: 'flex-start' }}
            >
              <span className="badge badge-discipline" style={{ fontSize: '0.7rem' }}>Electrical</span>
              <span>Ingest Electrical Daily Progress Report (6 events)</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
