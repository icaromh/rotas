const LZString = require('lz-string');
const poly = "c|h{F|b~G^p@|@vB\\|@\\d@b@j@@P?\\@l@@ZBn@?T`@?Xh@jABFBF\\fAFJDHzBvE?X";
const compressed = LZString.compressToEncodedURIComponent(poly);
console.log("compressed:", compressed);
