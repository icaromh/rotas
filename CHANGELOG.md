# Changelog

## v1
- **Performance Optimization**: Solved the massive latency (hanging for +5 min) in the LP Solver step by refactoring the Mixed Chinese Postman Problem to drop integer constraints, leveraging total unimodularity. Execution of polygons with 4000+ edges dropped from 5+ minutes to < 1 second.
- **Testing Infrastructure**: Added `vitest` for running local automated tests without the browser.
- **Test Fixtures**: Implemented a way to dump the scene geometry (`polygon`, `mode`, `overpassData`) to a `.json` fixture to reproduce bugs in unit tests.
- **UX Improvements**: Exposes `downloadFixture()` on the window object to cleanly download debug scenes without cluttering the UI.
- **Bug Fix**: Addressed a typo where the distance metric for calculating final kilometers returned NaN by explicitly passing the `distance` property down to the Eulerian Graph edge attributes.
