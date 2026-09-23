import React, { useState, useEffect } from 'react';
import { Layout } from './components/Layout';
import { PageId } from './components/Sidebar';
import { Dashboard } from './pages/Dashboard';
import { DataIngestion } from './pages/DataIngestion';
import { ScheduleExplorer } from './pages/ScheduleExplorer';
import { ProgressEvents } from './pages/ProgressEvents';
import { AITimeAgent } from './pages/AITimeAgent';
import { ReviewQueue } from './pages/ReviewQueue';
import { InstitutionalMemory } from './pages/InstitutionalMemory';
import { ToastProvider } from './components/ToastContext';
import { GlobalSearchModal } from './components/GlobalSearchModal';
import { ActivityDetailDrawer } from './components/ActivityDetailDrawer';
import { EventDetailDrawer } from './components/EventDetailDrawer';
import { ScheduleActivity, ProgressEvent } from './types';
import { api } from './api/client';

export const AppContent: React.FC = () => {
  const [currentPage, setCurrentPage] = useState<PageId>('dashboard');
  const [reviewCount, setReviewCount] = useState<number>(0);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [selectedActivity, setSelectedActivity] = useState<ScheduleActivity | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<ProgressEvent | null>(null);
  const [pageFilter, setPageFilter] = useState<{ status?: string; discipline?: string } | undefined>(undefined);

  const updateReviewCount = async () => {
    try {
      const res = await api.getReviewQueue();
      setReviewCount(res.count);
    } catch {
      // Ignored if server is starting
    }
  };

  useEffect(() => {
    updateReviewCount();
    const interval = setInterval(updateReviewCount, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleNavigateToPage = (page: string, filter?: { status?: string; discipline?: string }) => {
    setCurrentPage(page as PageId);
    setPageFilter(filter);
    updateReviewCount();
  };

  const handleSelectActivityFromSearch = (activity: ScheduleActivity) => {
    setSelectedActivity(activity);
    setIsSearchOpen(false);
  };

  const handleSelectEventFromSearch = (event: ProgressEvent) => {
    setSelectedEvent(event);
    setIsSearchOpen(false);
  };

  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard':
        return (
          <Dashboard
            onNavigateToPage={handleNavigateToPage}
            onNavigateToReview={() => handleNavigateToPage('review')}
            onOpenActivityDetail={(activity) => setSelectedActivity(activity)}
          />
        );
      case 'ingestion':
        return (
          <DataIngestion
            onNavigateToPage={handleNavigateToPage}
            onNavigateToMatching={() => handleNavigateToPage('dashboard')}
          />
        );
      case 'explorer':
        return (
          <ScheduleExplorer
            initialDiscipline={pageFilter?.discipline}
            onOpenActivityDetail={(activity) => setSelectedActivity(activity)}
          />
        );
      case 'events':
        return (
          <ProgressEvents
            initialStatus={pageFilter?.status}
            initialDiscipline={pageFilter?.discipline}
            onOpenEventDetail={(event) => setSelectedEvent(event)}
          />
        );
      case 'agent':
        return <AITimeAgent />;
      case 'review':
        return <ReviewQueue onReviewCountChange={(count) => setReviewCount(count)} />;
      case 'memory':
        return <InstitutionalMemory />;
      default:
        return (
          <Dashboard
            onNavigateToPage={handleNavigateToPage}
            onNavigateToReview={() => handleNavigateToPage('review')}
            onOpenActivityDetail={(activity) => setSelectedActivity(activity)}
          />
        );
    }
  };

  return (
    <>
      <Layout
        currentPage={currentPage}
        onSelectPage={(page) => {
          handleNavigateToPage(page, undefined);
        }}
        reviewCount={reviewCount}
        onOpenSearch={() => setIsSearchOpen(true)}
      >
        {renderPage()}
      </Layout>

      {/* Global Search Modal (Ctrl+K) */}
      {isSearchOpen && (
        <GlobalSearchModal
          isOpen={isSearchOpen}
          onClose={() => setIsSearchOpen(false)}
          onSelectActivity={handleSelectActivityFromSearch}
          onSelectEvent={handleSelectEventFromSearch}
        />
      )}

      {/* Global Activity Drawer if triggered from search or dashboard/explorer */}
      {selectedActivity && (
        <ActivityDetailDrawer
          activity={selectedActivity}
          onClose={() => setSelectedActivity(null)}
          onOpenEvent={(event) => {
            setSelectedActivity(null);
            setSelectedEvent(event);
          }}
        />
      )}

      {/* Global Event Drawer if triggered from search or events */}
      {selectedEvent && (
        <EventDetailDrawer
          event={selectedEvent}
          onClose={() => setSelectedEvent(null)}
          onOpenActivity={(activity) => {
            setSelectedEvent(null);
            setSelectedActivity(activity);
          }}
        />
      )}
    </>
  );
};

export const App: React.FC = () => {
  return (
    <ToastProvider>
      <AppContent />
    </ToastProvider>
  );
};
