import React, { useState, useEffect } from 'react';
import { Button } from './ui/Button';

interface Props {
  onPathsFetched: (paths: any) => void;
  showPaths: boolean;
  setShowPaths: (show: boolean) => void;
}

export const StravaIntegration: React.FC<Props> = ({ onPathsFetched, showPaths, setShowPaths }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    const userId = localStorage.getItem('strava_user_id');
    if (userId) {
      setIsAuthenticated(true);
    }
  }, []);

  const handleConnect = async () => {
    try {
      const res = await fetch('/api/auth/strava');
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (err) {
      console.error('Failed to get Strava auth URL', err);
      alert('Failed to connect to Strava backend.');
    }
  };

  const handleSync = async () => {
    const userId = localStorage.getItem('strava_user_id');
    if (!userId) return;

    setIsSyncing(true);
    try {
      const res = await fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId })
      });
      const data = await res.json();
      alert(`Sync complete! ${data.activitiesInserted || 0} activities inserted.`);
      
      // If currently showing paths, refresh them
      if (showPaths) {
        fetchPaths();
      }
    } catch (err) {
      console.error('Failed to sync', err);
      alert('Sync failed.');
    } finally {
      setIsSyncing(false);
    }
  };

  const fetchPaths = async () => {
    try {
      const res = await fetch('/api/paths');
      const data = await res.json();
      onPathsFetched(data);
    } catch (err) {
      console.error('Failed to fetch paths', err);
    }
  };

  const togglePaths = () => {
    if (!showPaths) {
      fetchPaths();
    } else {
      onPathsFetched({ type: 'FeatureCollection', features: [] });
    }
    setShowPaths(!showPaths);
  };

  return (
    <div className="flex items-center gap-2">
      {!isAuthenticated ? (
        <Button onClick={handleConnect} variant="primary" size="sm" className="bg-[#fc4c02] text-white hover:bg-[#e34402]">
          Connect Strava
        </Button>
      ) : (
        <>
          <Button onClick={handleSync} disabled={isSyncing} variant="secondary" size="sm">
            {isSyncing ? 'Syncing...' : 'Sync Strava'}
          </Button>
          <Button onClick={togglePaths} variant={showPaths ? 'primary' : 'secondary'} size="sm">
            {showPaths ? 'Hide My Paths' : 'Show My Paths'}
          </Button>
        </>
      )}
    </div>
  );
};
