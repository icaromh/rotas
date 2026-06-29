/**
 * @file gpxExport.test.ts
 *
 * Unit tests for the GPX export utility.
 *
 * GPX (GPS Exchange Format) is an XML schema used by GPS devices and apps to
 * store routes. buildGpxContent produces a valid GPX 1.1 XML string from a
 * list of {lat, lng} points.
 */

import { describe, it, expect } from 'vitest';
import { buildGpxContent } from '../src/utils/gpxExport';

describe('buildGpxContent (GPX export)', () => {
  const samplePath = [
    { lat: -23.5505, lng: -46.6333 }, // São Paulo
    { lat: -22.9068, lng: -43.1729 }, // Rio de Janeiro
    { lat: -19.9167, lng: -43.9345 }, // Belo Horizonte
  ];

  it('returns a string', () => {
    const result = buildGpxContent(samplePath);
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });

  it('starts with a valid XML declaration', () => {
    const result = buildGpxContent(samplePath);
    expect(result).toMatch(/^<\?xml version="1.0" encoding="UTF-8"\?>/);
  });

  it('contains a <gpx> root element with version 1.1', () => {
    const result = buildGpxContent(samplePath);
    expect(result).toContain('version="1.1"');
    expect(result).toContain('<gpx');
    expect(result).toContain('</gpx>');
  });

  it('contains a <trk> and <trkseg> wrapper', () => {
    const result = buildGpxContent(samplePath);
    expect(result).toContain('<trk>');
    expect(result).toContain('</trk>');
    expect(result).toContain('<trkseg>');
    expect(result).toContain('</trkseg>');
  });

  it('produces one <trkpt> element per path point', () => {
    const result = buildGpxContent(samplePath);
    const matches = result.match(/<trkpt /g);
    expect(matches).not.toBeNull();
    expect(matches!.length).toBe(samplePath.length);
  });

  it('embeds the lat/lng values for each point', () => {
    const result = buildGpxContent(samplePath);
    // Check that each coordinate appears in the output
    for (const point of samplePath) {
      expect(result).toContain(`lat="${point.lat}"`);
      expect(result).toContain(`lon="${point.lng}"`);
    }
  });

  it('embeds the default route name', () => {
    const result = buildGpxContent(samplePath);
    expect(result).toContain('<name>Optimized Route</name>');
  });

  it('embeds a custom route name when provided', () => {
    const result = buildGpxContent(samplePath, 'Morning Commute');
    expect(result).toContain('<name>Morning Commute</name>');
    expect(result).not.toContain('<name>Optimized Route</name>');
  });

  it('handles an empty path gracefully – produces GPX with no <trkpt> elements', () => {
    const result = buildGpxContent([]);
    // Should still produce valid wrapper XML
    expect(result).toContain('<trkseg>');
    // But no track points
    expect(result).not.toContain('<trkpt');
  });

  it('handles a single-point path', () => {
    const result = buildGpxContent([{ lat: 48.8566, lng: 2.3522 }]);
    const matches = result.match(/<trkpt /g);
    expect(matches).toHaveLength(1);
    expect(result).toContain('lat="48.8566"');
  });
});
