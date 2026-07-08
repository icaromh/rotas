import React, { useState, useEffect, useRef } from 'react';
import { Button } from './ui/Button';
import { useAppStore } from '../store/useAppStore';

interface Props {
  onPathsFetched?: (paths: any) => void;
  showPaths?: boolean;
  setShowPaths?: (show: boolean) => void;
}

export const StravaUserMenu: React.FC<Props> = ({ onPathsFetched, showPaths = false, setShowPaths }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<string | null>(null);
  const [profileUrl, setProfileUrl] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const stravaColor = useAppStore(state => state.stravaColor);
  const stravaOpacity = useAppStore(state => state.stravaOpacity);
  const setStravaColor = useAppStore(state => state.setStravaColor);
  const setStravaOpacity = useAppStore(state => state.setStravaOpacity);

  useEffect(() => {
    const userId = localStorage.getItem('strava_user_id');
    const pUrl = localStorage.getItem('strava_profile_url');
    if (userId) setIsAuthenticated(true);
    if (pUrl) setProfileUrl(pUrl);

    // Close menu when clicking outside
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleConnect = async () => {
    try {
      const res = await fetch('/api/auth/strava');
      const data = await res.json();
      if (data.url) window.location.href = data.url;
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
        setSyncStatus('Syncing... You can keep using the app.');
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
          setSyncStatus(`Syncing... (${data.inserted} inserted)`);
        } else if (data.status === 'completed') {
          clearInterval(interval);
          setSyncStatus(`Complete! ${data.inserted} activities inserted.`);
          setIsSyncing(false);
          setTimeout(() => setSyncStatus(null), 5000);
        } else if (data.status === 'error') {
          clearInterval(interval);
          setSyncStatus(`Sync failed. ${data.error}`);
          setIsSyncing(false);
          setTimeout(() => setSyncStatus(null), 5000);
        } else {
           clearInterval(interval);
           setIsSyncing(false);
        }
      } catch (err) {
        clearInterval(interval);
        setIsSyncing(false);
      }
    }, 2500);
  };

  const handleLogout = () => {
    localStorage.removeItem('strava_user_id');
    localStorage.removeItem('strava_profile_url');
    setIsAuthenticated(false);
    setProfileUrl(null);
    setIsOpen(false);
  };

  return (
    <div className="relative" ref={menuRef}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-center w-8 h-8 rounded-full bg-gray-200 hover:bg-gray-300 transition outline-none overflow-hidden border border-gray-300 shrink-0"
        title="Strava Account"
      >
        {isAuthenticated && profileUrl ? (
          <img src={profileUrl} alt="Strava Profile" className="w-full h-full object-cover" />
        ) : (
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-500">
            <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
        )}
      </button>

      {isOpen && (
        <div className="absolute top-full mt-2 right-0 w-64 bg-white rounded-xl shadow-lg border border-gray-200 p-4 z-[9999] flex flex-col gap-3">
          <div className="flex items-center gap-2 border-b border-gray-100 pb-2 mb-1">
            <span className="font-semibold text-gray-700 text-sm">Strava Connection</span>
          </div>

          {!isAuthenticated ? (
            <div className="flex flex-col gap-3">
              <Button onClick={handleConnect} variant="primary" size="sm" className="bg-[#fc4c02] text-white hover:bg-[#e34402] w-full justify-center">
                Connect Strava
              </Button>
            </div>
          ) : (
            <div className="flex flex-col gap-4 text-sm">
              {/* Map Settings Section */}
              <div className="flex flex-col gap-2">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Map Overlay</span>
                <label className="flex items-center justify-between cursor-pointer p-2 bg-gray-50 hover:bg-gray-100 rounded border border-gray-200 transition-colors">
                  <span className="font-medium text-gray-700 text-sm">Show My Paths</span>
                <div className="relative">
                  <input type="checkbox" className="sr-only" checked={showPaths} onChange={() => {
                    if (!showPaths) {
                      fetch('/api/paths')
                        .then(res => res.json())
                        .then(data => onPathsFetched && onPathsFetched(data))
                        .catch(err => console.error('Failed to fetch paths', err));
                    } else {
                      if (onPathsFetched) onPathsFetched({ type: 'FeatureCollection', features: [] });
                    }
                    if (setShowPaths) setShowPaths(!showPaths);
                  }} />
                  <div className={`block w-10 h-6 rounded-full transition-colors ${showPaths ? 'bg-[#fc4c02]' : 'bg-gray-300'}`}></div>
                  <div className={`absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${showPaths ? 'transform translate-x-4' : ''}`}></div>
                </div>
              </label>

              {showPaths && (
                <div className="flex flex-col gap-2 p-2 bg-gray-50 border border-gray-200 rounded">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-gray-600">Color</span>
                    <input 
                      type="color" 
                      value={stravaColor} 
                      onChange={(e) => setStravaColor(e.target.value)} 
                      className="w-6 h-6 p-0 border-0 rounded cursor-pointer"
                    />
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-medium text-gray-600">Opacity</span>
                    <input 
                      type="range" 
                      min="0.1" 
                      max="1" 
                      step="0.1" 
                      value={stravaOpacity} 
                      onChange={(e) => setStravaOpacity(parseFloat(e.target.value))} 
                      className="w-24 accent-[#fc4c02]"
                    />
                  </div>
                </div>
              )}
              </div>

              {/* Data Sync Section */}
              <div className="flex flex-col gap-2 border-t border-gray-100 pt-3">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Data Sync</span>
                <Button onClick={handleSync} disabled={isSyncing} variant="primary" size="sm" className="w-full justify-center bg-[#fc4c02] text-white hover:bg-[#e34402]">
                  {isSyncing ? 'Syncing...' : 'Sync Now'}
                </Button>
                {syncStatus && (
                  <div className="p-2 bg-gray-50 rounded text-xs text-center border border-gray-100 text-gray-600">
                    {syncStatus}
                  </div>
                )}
              </div>

              {/* Account Section */}
              <div className="flex flex-col gap-2 border-t border-gray-100 pt-3">
                <Button onClick={handleLogout} variant="ghost" size="sm" className="w-full justify-center text-red-500 hover:text-red-600 hover:bg-red-50">
                  Disconnect
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
