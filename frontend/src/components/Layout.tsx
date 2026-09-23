import React, { useState, useEffect } from 'react';
import { Sidebar, PageId } from './Sidebar';

interface Props {
  currentPage: PageId;
  onSelectPage: (page: PageId) => void;
  reviewCount?: number;
  onOpenSearch?: () => void;
  children: React.ReactNode;
}

export const Layout: React.FC<Props> = ({
  currentPage,
  onSelectPage,
  reviewCount,
  onOpenSearch,
  children,
}) => {
  const [isPinned, setIsPinned] = useState(true);
  const [isHovered, setIsHovered] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (onOpenSearch) onOpenSearch();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onOpenSearch]);

  const handleTogglePin = () => {
    setIsPinned((prev) => !prev);
    setIsHovered(false);
  };

  return (
    <div className="app-container">
      <Sidebar
        currentPage={currentPage}
        onSelectPage={onSelectPage}
        reviewCount={reviewCount}
        onOpenSearch={onOpenSearch}
        isPinned={isPinned}
        isHovered={isHovered}
        onTogglePin={handleTogglePin}
        onHoverChange={setIsHovered}
      />
      <main className={`main-content ${!isPinned ? 'sidebar-collapsed' : ''}`}>
        {children}
      </main>
    </div>
  );
};
