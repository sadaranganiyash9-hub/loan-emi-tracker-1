/* shared by the test files so both add up to one total */

let passed = 0;
let failed = 0;

function check(description, isTrue) {
  if (isTrue) {
    passed++;
    console.log("  PASS  " + description);
  } else {
    failed++;
    console.log("  FAIL  " + description);
  }
}

function section(title) {
  console.log("\n" + title);
}

/* true if fn threw - for checks where throwing is the correct behaviour */
function throws(fn) {
  try {
    fn();
    return false;
  } catch (error) {
    return true;
  }
}

function summary() {
  console.log("\n" + "-".repeat(50));
  if (failed === 0) {
    console.log(passed + " checks passed, nothing failed");
  } else {
    console.log(passed + " passed, " + failed + " FAILED");
  }
  return failed;
}

module.exports = { check, section, throws, summary };
