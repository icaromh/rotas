const fs = require('fs');
const worker = require('./src/workers/optimizer.worker.ts');
require('ts-node').register(); // To run TS file if needed? Wait, node can't run TS directly.
