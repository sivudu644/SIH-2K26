import React, { useRef } from 'react';
import {
  LayoutDashboard,
  UploadCloud,
  CalendarDays,
  ActivitySquare,
  Bot,
  ListChecks,
  BrainCircuit,
  ShieldCheck,
  Search,
  Menu,
} from 'lucide-react';

export type PageId =
  | 'dashboard'
  | 'ingestion'
  | 'explorer'
  | 'events'
  | 'agent'
  | 'review'
  | 'memory';

interface Props {
  currentPage: PageId;
  onSelectPage: (page: PageId) => void;
  reviewCount?: number;
  onOpenSearch?: () => void;
  isPinned?: boolean;
  isHovered?: boolean;
  onTogglePin?: () => void;
  onHoverChange?: (hovered: boolean) => void;
}

export const Sidebar: React.FC<Props> = ({
  currentPage,
  onSelectPage,
  reviewCount = 0,
  onOpenSearch,
  isPinned = true,
  isHovered = false,
  onTogglePin,
  onHoverChange,
}) => {
  const leaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ignoreHoverUntilLeaveRef = useRef<boolean>(false);
  const isOpen = isPinned || isHovered;

  const menuItems = [
    { id: 'dashboard' as PageId, label: 'Dashboard', icon: LayoutDashboard },
    { id: 'ingestion' as PageId, label: 'Data Ingestion', icon: UploadCloud },
    { id: 'explorer' as PageId, label: 'Schedule Explorer', icon: CalendarDays },
    { id: 'events' as PageId, label: 'Progress Events', icon: ActivitySquare },
    { id: 'agent' as PageId, label: 'AI Time Agent', icon: Bot },
    { id: 'review' as PageId, label: 'Review Queue', icon: ListChecks, count: reviewCount },
    { id: 'memory' as PageId, label: 'Institutional Memory', icon: BrainCircuit },
  ];

  const handleHamburgerMouseEnter = () => {
    if (leaveTimeoutRef.current) {
      clearTimeout(leaveTimeoutRef.current);
      leaveTimeoutRef.current = null;
    }
    if (!isPinned && !ignoreHoverUntilLeaveRef.current) {
      onHoverChange?.(true);
    }
  };

  const handleSidebarMouseEnter = () => {
    if (leaveTimeoutRef.current) {
      clearTimeout(leaveTimeoutRef.current);
      leaveTimeoutRef.current = null;
    }
    if (!isPinned && !ignoreHoverUntilLeaveRef.current) {
      onHoverChange?.(true);
    }
  };

  const handleSidebarMouseLeave = () => {
    ignoreHoverUntilLeaveRef.current = false;
    if (!isPinned) {
      if (leaveTimeoutRef.current) {
        clearTimeout(leaveTimeoutRef.current);
      }
      leaveTimeoutRef.current = setTimeout(() => {
        onHoverChange?.(false);
      }, 250);
    }
  };

  const handleToggleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (leaveTimeoutRef.current) {
      clearTimeout(leaveTimeoutRef.current);
      leaveTimeoutRef.current = null;
    }
    if (isPinned) {
      ignoreHoverUntilLeaveRef.current = true;
    } else {
      ignoreHoverUntilLeaveRef.current = false;
    }
    onTogglePin?.();
  };

  const handleNavClick = (pageId: PageId) => {
    onSelectPage(pageId);
    if (!isPinned) {
      onHoverChange?.(false);
    }
  };

  return (
    <aside
      className={`sidebar ${!isOpen ? 'collapsed' : ''} ${!isPinned && isHovered ? 'hover-preview' : ''}`}
      onMouseEnter={handleSidebarMouseEnter}
      onMouseLeave={handleSidebarMouseLeave}
    >
      {/* Header / Brand & Hamburger */}
      <div
        className="sidebar-header"
        style={{
          padding: '16px 14px',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          minHeight: '69px',
          justifyContent: isOpen ? 'flex-start' : 'center',
          boxSizing: 'border-box',
        }}
      >
        <button
          type="button"
          className="hamburger-btn"
          onClick={handleToggleClick}
          onMouseEnter={handleHamburgerMouseEnter}
          aria-label={isOpen ? 'Close navigation' : 'Open navigation'}
          aria-expanded={isOpen}
          title={isOpen ? (isPinned ? 'Collapse sidebar' : 'Pin sidebar open') : 'Expand sidebar'}
        >
          <Menu size={18} />
        </button>

        {isOpen && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              overflow: 'hidden',
              whiteSpace: 'nowrap',
              animation: 'fadeIn 0.2s ease-out',
            }}
          >
            <div
              style={{
                width: '32px',
                height: '32px',
                minWidth: '32px',
                borderRadius: '8px',
                background: 'linear-gradient(135deg, #0284c7 0%, #06b6d4 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                boxShadow: '0 2px 10px rgba(6, 182, 212, 0.4)',
              }}
            >
              <ShieldCheck size={20} />
            </div>
            <div>
              <div style={{ fontWeight: 800, fontSize: '1.02rem', letterSpacing: '-0.02em', color: '#fff' }}>
                InfraSync AI
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Quick Search Button */}
      {onOpenSearch && (
        <div style={{ padding: '14px 14px 6px', display: 'flex', justifyContent: 'center' }}>
          <button
            type="button"
            onClick={onOpenSearch}
            className="search-btn"
            title={!isOpen ? 'Quick Search (Ctrl+K)' : undefined}
            aria-label="Quick Search"
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: isOpen ? 'space-between' : 'center',
              backgroundColor: 'rgba(31, 41, 55, 0.6)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              padding: isOpen ? '8px 12px' : '8px 0',
              color: 'var(--text-secondary)',
              fontSize: '0.8rem',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = 'var(--accent-cyan)';
              e.currentTarget.style.color = '#fff';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'var(--border)';
              e.currentTarget.style.color = 'var(--text-secondary)';
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Search size={16} />
              {isOpen && <span>Quick Search</span>}
            </div>
            {isOpen && (
              <kbd
                style={{
                  fontSize: '0.65rem',
                  backgroundColor: 'rgba(0, 0, 0, 0.4)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  padding: '2px 5px',
                  borderRadius: '4px',
                  color: 'var(--text-muted)',
                }}
              >
                Ctrl K
              </kbd>
            )}
          </button>
        </div>
      )}

      {/* Navigation */}
      <nav style={{ padding: '10px 0', flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
        {isOpen && (
          <div style={{ padding: '0 16px 8px', fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Navigation
          </div>
        )}
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentPage === item.id;
          return (
            <div
              key={item.id}
              className={`nav-item ${isActive ? 'active' : ''}`}
              onClick={() => handleNavClick(item.id)}
              title={!isOpen ? item.label : undefined}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: isOpen ? '12px' : '0',
                justifyContent: isOpen ? 'flex-start' : 'center',
                padding: isOpen ? '10px 14px' : '10px 0',
                margin: isOpen ? '3px 12px' : '3px 12px',
                borderRadius: 'var(--radius-md)',
                cursor: 'pointer',
                position: 'relative',
                transition: 'all 0.2s ease',
              }}
            >
              <Icon size={18} style={{ minWidth: '18px' }} />
              {isOpen && <span style={{ flex: 1, whiteSpace: 'nowrap' }}>{item.label}</span>}
              {item.count !== undefined && item.count > 0 && (
                isOpen ? (
                  <span
                    style={{
                      backgroundColor: 'rgba(245, 158, 11, 0.2)',
                      color: '#fbbf24',
                      border: '1px solid rgba(245, 158, 11, 0.4)',
                      fontSize: '0.725rem',
                      padding: '1px 7px',
                      borderRadius: '999px',
                      fontWeight: 700,
                    }}
                  >
                    {item.count}
                  </span>
                ) : (
                  <span
                    style={{
                      position: 'absolute',
                      top: '5px',
                      right: '5px',
                      width: '7px',
                      height: '7px',
                      borderRadius: '50%',
                      backgroundColor: '#fbbf24',
                      boxShadow: '0 0 6px #fbbf24',
                    }}
                  />
                )
              )}
            </div>
          );
        })}
      </nav>

      {/* Footer Info */}
      <div
        style={{
          padding: isOpen ? '16px 18px' : '16px 14px',
          borderTop: '1px solid var(--border)',
          fontSize: '0.75rem',
          color: 'var(--text-muted)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: isOpen ? 'flex-start' : 'center',
          transition: 'all 0.2s ease',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: isOpen ? '4px' : '0' }}>
          <span
            style={{
              width: '8px',
              height: '8px',
              minWidth: '8px',
              borderRadius: '50%',
              backgroundColor: '#10b981',
              display: 'inline-block',
              boxShadow: '0 0 6px rgba(16, 185, 129, 0.6)',
            }}
            title={!isOpen ? 'DEMO MODE Active: Deterministic AI Engine' : undefined}
          />
          {isOpen && (
            <span style={{ color: '#9ca3af', fontWeight: 600, whiteSpace: 'nowrap' }}>
              DEMO MODE Active
            </span>
          )}
        </div>
        {isOpen && (
          <div style={{ whiteSpace: 'nowrap' }}>
            Deterministic AI Engine
          </div>
        )}
      </div>
    </aside>
  );
};
