const fs = require('fs');
let content = fs.readFileSync('CHANGELOG.md', 'utf8');

// remove the stuff I appended at the bottom
content = content.replace(/\n### Fixed\n- Fixed UI state for shared routes to properly display the "New Plan" button instead of "Plan Route" in mobile view\.\n- Fixed a bug where URL parameters losing their \`\+\` encoding \(converted to spaces\) caused LZString decompression to fail, resulting in corrupted polyline generation\.\n/g, '');

const newEntry = `
## v1.4.3
- **Shared Route Fixes**: Fixed a bug where URL parameters losing their \`+\` encoding (converted to spaces) caused LZString decompression to fail, resulting in corrupted path generation. Additionally, ensured that the mobile navigation button accurately displays "New Plan" instead of "Plan Route" when viewing shared routes.
`;

content = content.replace('# Changelog\n', '# Changelog\n' + newEntry);
fs.writeFileSync('CHANGELOG.md', content);
