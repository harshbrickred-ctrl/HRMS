const compiled = require('../dist/main.js');

module.exports = typeof compiled === 'function' ? compiled : compiled.default;
