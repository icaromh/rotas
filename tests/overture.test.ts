import {
  bboxToTiles,
  lonLatToTile,
  matchesRoadFilter,
  parseOnewayDirection,
} from '../worker/overture';

describe('worker/overture helpers', () => {
  describe('lonLatToTile & bboxToTiles', () => {
    it('computes expected Z14 tile for central Barcelona', () => {
      expect(lonLatToTile(2.1685, 41.3875, 14)).toEqual({ x: 8290, y: 6119 });
    });

    it('returns all tiles intersecting a small bounding box', () => {
      const tiles = bboxToTiles([41.387, 2.168, 41.388, 2.169], 14);
      expect(tiles).toEqual([{ z: 14, x: 8290, y: 6119 }]);
    });
  });

  describe('matchesRoadFilter', () => {
    it('rejects non-road subtypes (rail, water)', () => {
      expect(matchesRoadFilter({ subtype: 'rail', class: 'subway' }, 'bike', 'any')).toBe(false);
      expect(matchesRoadFilter({ subtype: 'water', class: 'river' }, 'walk', 'any')).toBe(false);
    });

    it('filters bike strict mode to cycleways only', () => {
      expect(matchesRoadFilter({ subtype: 'road', class: 'cycleway' }, 'bike', 'strict')).toBe(true);
      expect(matchesRoadFilter({ subtype: 'road', class: 'residential' }, 'bike', 'strict')).toBe(false);
    });

    it('filters bike safe mode to exclude primary roads', () => {
      expect(matchesRoadFilter({ subtype: 'road', class: 'primary' }, 'bike', 'safe')).toBe(false);
      expect(matchesRoadFilter({ subtype: 'road', class: 'secondary' }, 'bike', 'safe')).toBe(true);
      expect(matchesRoadFilter({ subtype: 'road', class: 'residential' }, 'bike', 'safe')).toBe(true);
    });

    it('allows primary roads in bike any mode and walk mode', () => {
      expect(matchesRoadFilter({ subtype: 'road', class: 'primary' }, 'bike', 'any')).toBe(true);
      expect(matchesRoadFilter({ subtype: 'road', class: 'primary' }, 'walk', 'any')).toBe(true);
      expect(matchesRoadFilter({ subtype: 'road', class: 'cycleway' }, 'walk', 'any')).toBe(false);
    });
  });

  describe('parseOnewayDirection', () => {
    it('returns both for walk mode regardless of access restrictions', () => {
      const raw = JSON.stringify([{ access_type: 'denied', when: { heading: 'backward' } }]);
      expect(parseOnewayDirection(raw, 'walk')).toBe('both');
    });

    it('detects forward oneway when backward heading is denied', () => {
      const raw = JSON.stringify([{ access_type: 'denied', when: { heading: 'backward' } }]);
      expect(parseOnewayDirection(raw, 'bike')).toBe('forward');
    });

    it('detects backward oneway when forward heading is denied', () => {
      const raw = JSON.stringify([{ access_type: 'denied', when: { heading: 'forward' } }]);
      expect(parseOnewayDirection(raw, 'bike')).toBe('backward');
    });

    it('allows bidirectional cycling when bicycle is explicitly allowed', () => {
      const raw = JSON.stringify([
        { access_type: 'denied', when: { heading: 'backward' } },
        { access_type: 'allowed', when: { mode: ['bicycle'] } },
      ]);
      expect(parseOnewayDirection(raw, 'bike')).toBe('both');
    });
  });
});
