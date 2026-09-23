import React from 'react';
import { LucideIcon } from 'lucide-react';

interface Props {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  color?: 'cyan' | 'emerald' | 'amber' | 'rose' | 'indigo' | 'blue';
}

export const StatsCard: React.FC<Props> = ({
  title,
  value,
  subtitle,
  icon: Icon,
  color = 'cyan',
}) => {
  const colorMap = {
    cyan: { bg: 'rgba(6, 182, 212, 0.15)', text: '#22d3ee' },
    emerald: { bg: 'rgba(16, 185, 129, 0.15)', text: '#34d399' },
    amber: { bg: 'rgba(245, 158, 11, 0.15)', text: '#fbbf24' },
    rose: { bg: 'rgba(244, 63, 94, 0.15)', text: '#fb7185' },
    indigo: { bg: 'rgba(99, 102, 241, 0.15)', text: '#818cf8' },
    blue: { bg: 'rgba(59, 130, 246, 0.15)', text: '#60a5fa' },
  };

  const style = colorMap[color];

  return (
    <div className={`stat-card ${color}`}>
      <div className="stat-header">
        <span className="stat-title">{title}</span>
        <div className="stat-icon" style={{ backgroundColor: style.bg, color: style.text }}>
          <Icon size={18} />
        </div>
      </div>
      <div>
        <div className="stat-value">{value}</div>
        {subtitle && <div className="stat-sub">{subtitle}</div>}
      </div>
    </div>
  );
};
