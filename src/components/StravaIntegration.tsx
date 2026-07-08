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
  const [syncStatus, setSyncStatus] = useState<string | null>(null);

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
    setSyncStatus('Starting sync...');
    
    try {
      const res = await fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId })
      });
      
      if (res.status === 202) {
        setSyncStatus('Syncing in background... You can keep using the app.');
        pollSyncStatus(userId);
      } else if (res.status === 409) {
        setSyncStatus('Sync already in progress.');
        pollSyncStatus(userId);
      } else {
        const data = await res.json();
        setSyncStatus(`Sync failed: ${data.error}`);
        setIsSyncing(false);
      }
    } catch (err) {
      console.error('Failed to start sync', err);
      setSyncStatus('Sync failed to start.');
      setIsSyncing(false);
    }
  };

  const pollSyncStatus = (userId: string) => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/sync/status?userId=${userId}`);
        const data = await res.json();
        
        if (data.status === 'running') {
          setSyncStatus(`Syncing in background... (${data.inserted} inserted)`);
        } else if (data.status === 'completed') {
          clearInterval(interval);
          setSyncStatus(`Sync complete! ${data.inserted} activities inserted.`);
          setIsSyncing(false);
          if (showPaths) fetchPaths();
          setTimeout(() => setSyncStatus(null), 5000);
        } else if (data.status === 'error') {
          clearInterval(interval);
          setSyncStatus(`Sync failed. ${data.error}`);
          setIsSyncing(false);
          setTimeout(() => setSyncStatus(null), 5000);
        } else {
           // idle or unknown
           clearInterval(interval);
           setIsSyncing(false);
        }
      } catch (err) {
        console.error('Failed to poll status', err);
        clearInterval(interval);
        setIsSyncing(false);
      }
    }, 2500);
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
    <div className="flex flex-col items-end gap-1">
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
      {syncStatus && (
        <div className="text-xs text-gray-500 font-medium absolute -bottom-5 right-0 whitespace-nowrap bg-white px-2 py-0.5 rounded shadow-sm border border-gray-100 z-50">
          {syncStatus}
        </div>
      )}
    </div>
  );
};
