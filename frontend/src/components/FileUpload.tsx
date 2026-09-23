import React, { useRef, useState } from 'react';
import { UploadCloud, FileText, CheckCircle2, AlertCircle } from 'lucide-react';

interface Props {
  accept: string;
  title: string;
  subtitle: string;
  onUpload: (file: File) => Promise<void>;
  sampleButtonLabel?: string;
  onLoadSample?: () => Promise<void>;
}

export const FileUpload: React.FC<Props> = ({
  accept,
  title,
  subtitle,
  onUpload,
  sampleButtonLabel,
  onLoadSample,
}) => {
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const file = files[0];
    setUploading(true);
    setStatusMessage(null);
    try {
      await onUpload(file);
      setStatusMessage({ type: 'success', text: `Uploaded and processed "${file.name}" successfully!` });
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Upload failed.' });
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const handleSample = async () => {
    if (!onLoadSample) return;
    setUploading(true);
    setStatusMessage(null);
    try {
      await onLoadSample();
      setStatusMessage({ type: 'success', text: 'Sample data loaded and processed successfully!' });
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Failed to load sample data.' });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div>
        <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#fff', marginBottom: '4px' }}>{title}</h3>
        <p style={{ fontSize: '0.825rem', color: 'var(--text-secondary)' }}>{subtitle}</p>
      </div>

      <div
        className={`dropzone ${dragOver ? 'dragover' : ''}`}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files); }}
        onClick={() => inputRef.current?.click()}
      >
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          style={{ display: 'none' }}
          onChange={(e) => handleFiles(e.target.files)}
        />
        <UploadCloud size={36} color="#06b6d4" style={{ margin: '0 auto 12px' }} />
        <div style={{ fontWeight: 600, fontSize: '0.9rem', color: '#f3f4f6' }}>
          {uploading ? 'Processing File...' : 'Click to Browse or Drag & Drop'}
        </div>
        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
          Supported formats: {accept.toUpperCase().replace(/\./g, ' ')}
        </div>
      </div>

      {statusMessage && (
        <div
          style={{
            padding: '10px 14px',
            borderRadius: 'var(--radius-md)',
            fontSize: '0.825rem',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            backgroundColor: statusMessage.type === 'success' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(244, 63, 94, 0.15)',
            color: statusMessage.type === 'success' ? '#34d399' : '#fb7185',
            border: `1px solid ${statusMessage.type === 'success' ? 'rgba(16, 185, 129, 0.3)' : 'rgba(244, 63, 94, 0.3)'}`,
          }}
        >
          {statusMessage.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
          <span>{statusMessage.text}</span>
        </div>
      )}

      {onLoadSample && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '8px', borderTop: '1px solid var(--border)' }}>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={handleSample}
            disabled={uploading}
          >
            <FileText size={14} />
            <span>{sampleButtonLabel || 'Load Synthetic Sample'}</span>
          </button>
        </div>
      )}
    </div>
  );
};
