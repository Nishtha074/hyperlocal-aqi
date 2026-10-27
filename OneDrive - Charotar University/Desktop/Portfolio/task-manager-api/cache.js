const NodeCache = require("node-cache");

const cache = new NodeCache({
  stdTTL: 60
});

module.exports = cache;