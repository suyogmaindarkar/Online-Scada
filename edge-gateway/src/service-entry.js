'use strict';

// Windows Service entry point. It starts the normal connector from a stable
// working directory so the service does not depend on an interactive shell.
const path = require('path');
process.chdir(path.resolve(__dirname, '..'));
require('./index');
