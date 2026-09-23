import React from 'react';

interface Props {
  confidence?: number;
  status?: string;
  showPercent?: boolean;
}

export const ConfidenceBadge: React.FC<Props> = ({ confidence, status, showPercent = true }) => {
  if (confidence === undefined || confidence === null) {
    if (status) {
      return <span className="badge badge-neutral">{status}</span>;
    }
    return <span className="badge badge-neutral">—</span>;
  }

  let badgeClass = 'badge-low';
  let label = 'Low';

  if (confidence >= 0.85) {
    badgeClass = 'badge-high';
    label = 'Auto Match (≥85%)';
  } else if (confidence >= 0.65) {
    badgeClass = 'badge-medium';
    label = 'Review Required';
  } else {
    badgeClass = 'badge-low';
    label = 'Unmatched (<65%)';
  }

  const pct = Math.round(confidence * 100);

  return (
    <span className={`badge ${badgeClass}`} title={`Confidence Score: ${confidence.toFixed(3)}`}>
      {showPercent ? `${pct}% • ${label}` : label}
    </span>
  );
};
