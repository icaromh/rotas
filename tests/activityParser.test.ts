import { gzipSync, strToU8, zipSync } from 'fflate';
import {
  activitiesToFeatureCollection,
  parseActivityBytes,
  parseGeoJson,
  parseGpx,
  parseTcx,
  simplifyCoordinates,
} from '../src/utils/activityParser';

const SAMPLE_GPX = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1">
  <trk>
    <name>Morning Ride</name>
    <trkseg>
      <trkpt lat="41.387" lon="2.168"></trkpt>
      <trkpt lat="41.388" lon="2.169"></trkpt>
      <trkpt lat="41.389" lon="2.170"></trkpt>
    </trkseg>
  </trk>
</gpx>`;

const SAMPLE_TCX = `<?xml version="1.0" encoding="UTF-8"?>
<TrainingCenterDatabase>
  <Activities>
    <Activity Sport="Biking">
      <Id>2026-07-01T08:00:00Z</Id>
      <Lap>
        <Track>
          <Trackpoint>
            <Position>
              <LatitudeDegrees>41.387</LatitudeDegrees>
              <LongitudeDegrees>2.168</LongitudeDegrees>
            </Position>
          </Trackpoint>
          <Trackpoint>
            <Position>
              <LatitudeDegrees>41.388</LatitudeDegrees>
              <LongitudeDegrees>2.169</LongitudeDegrees>
            </Position>
          </Trackpoint>
        </Track>
      </Lap>
    </Activity>
  </Activities>
</TrainingCenterDatabase>`;

describe('activityParser', () => {
  it('parses GPX tracks into [lng, lat] coordinates', () => {
    const activity = parseGpx(SAMPLE_GPX, 'fallback.gpx');
    expect(activity).not.toBeNull();
    expect(activity?.name).toBe('Morning Ride');
    expect(activity?.coordinates).toEqual([
      [2.168, 41.387],
      [2.169, 41.388],
      [2.17, 41.389],
    ]);
  });

  it('parses TCX tracks into [lng, lat] coordinates', () => {
    const activity = parseTcx(SAMPLE_TCX, 'ride.tcx');
    expect(activity).not.toBeNull();
    expect(activity?.name).toBe('2026-07-01T08:00:00Z');
    expect(activity?.coordinates).toEqual([
      [2.168, 41.387],
      [2.169, 41.388],
    ]);
  });

  it('parses GeoJSON FeatureCollections', () => {
    const geoJson = JSON.stringify({
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: { name: 'Loop' },
          geometry: {
            type: 'LineString',
            coordinates: [
              [2.1, 41.3],
              [2.2, 41.4],
            ],
          },
        },
      ],
    });
    const activities = parseGeoJson(geoJson, 'export.geojson');
    expect(activities).toHaveLength(1);
    expect(activities[0].name).toBe('Loop');
    expect(activities[0].coordinates).toEqual([
      [2.1, 41.3],
      [2.2, 41.4],
    ]);
  });

  it('parses Strava-style ZIP archives containing .gpx and .gpx.gz files', () => {
    const archive = zipSync({
      'activities/ride1.gpx': strToU8(SAMPLE_GPX),
      'activities/ride2.gpx.gz': gzipSync(strToU8(SAMPLE_GPX)),
      'activities/notes.txt': strToU8('ignored'),
    });

    const parsed = parseActivityBytes(archive, 'export_12345.zip');
    expect(parsed).toHaveLength(2);

    const fc = activitiesToFeatureCollection(parsed);
    expect(fc.type).toBe('FeatureCollection');
    expect(fc.features).toHaveLength(2);
    expect(fc.features[0].geometry.type).toBe('LineString');
  });

  it('simplifies dense tracks while preserving endpoints', () => {
    const dense: [number, number][] = Array.from({ length: 1000 }, (_, i) => [i, i]);
    const simplified = simplifyCoordinates(dense, 100);
    expect(simplified).toHaveLength(100);
    expect(simplified[0]).toEqual([0, 0]);
    expect(simplified[simplified.length - 1]).toEqual([999, 999]);
  });
});
