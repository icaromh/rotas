import React from 'react';
import { DownloadIcon } from './icons';
import { Button } from './ui/Button';
import { downloadGpx } from '../utils/gpxExport';
import { useTranslation } from 'react-i18next';
import type { Point } from '../utils/routeSharing';
import { usePostHog } from 'posthog-js/react';

interface Props {
  path: Point[];
  filename?: string;
  className?: string;
}

/**
 * Self-contained button that builds and downloads a GPX file from the given path.
 * Disabled automatically when `path` is empty.
 */
export const ExportGpxButton: React.FC<Props> = ({ path, filename, className }) => {
  const { t } = useTranslation();
  const posthog = usePostHog();

  const handleClick = () => {
    posthog.capture('gpx_exported', {
      waypoint_count: path.length,
    });
    downloadGpx(path, filename);
  };

  return (
    <Button
      id="export-gpx-btn"
      onClick={handleClick}
      disabled={path.length === 0}
      variant="dark"
      size="sm"
      className={className}
    >
      <DownloadIcon size={16} />
      {t('sidebar.actions.gpx')}
    </Button>
  );
};
