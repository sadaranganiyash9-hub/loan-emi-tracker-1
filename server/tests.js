/* npm test runs this, so both files report one combined total */

const { summary } = require("./test-helpers.js");

require("./emi.test.js");
require("./loanView.test.js");

process.exit(summary() > 0 ? 1 : 0);
