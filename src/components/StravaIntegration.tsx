import React, { useState, useEffect } from 'react';
import { Button } from './ui/Button';

interface Props {
  onPathsFetched: (paths: any) => void;
  showPaths: boolean;
  setShowPaths: (show: boolean) => void;
}

export const StravaIntegration: React.FC<Props> = ({ onPathsFetched, showPaths, setShowPaths }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    // Basic check for auth status
    const userId = localStorage.getItem('strava_user_id');
    if (userId) {
      setIsAuthenticated(true);
    }
  }, []);

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

  // Only render the paths toggle if the user is logged in
  if (!isAuthenticated) return null;

  return (
    <div className="flex items-center">
      <Button onClick={togglePaths} variant={showPaths ? 'primary' : 'secondary'} size="sm">
        {showPaths ? 'Hide My Paths' : 'Show My Paths'}
      </Button>
    </div>
  );
};
