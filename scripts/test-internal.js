/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 */

/* @flow */

import type { CompilerDiagnostics, ErrorHandlerResult } from "../lib/errors.js";
import type { BabelNodeSourceLocation } from "babel-types";
import { prepack } from "../lib/prepack-node.js";

let chalk = require("chalk");
let path  = require("path");
let fs    = require("fs");

function search(dir, relative) {
  let tests = [];

  if (fs.existsSync(dir)) {
    for (let name of fs.readdirSync(dir)) {
      let loc = path.join(dir, name);
      let stat = fs.statSync(loc);

      if (stat.isFile()) {
        tests.push({
          file: fs.readFileSync(loc, "utf8"),
          name: path.join(relative, name)
        });
      } else if (stat.isDirectory()) {
        tests = tests.concat(search(loc, path.join(relative, name)));
      }
    }
  }

  return tests;
}

let tests = search(`${__dirname}/../test/internal`, "test/internal");

let errors: Map<BabelNodeSourceLocation, CompilerDiagnostics> = new Map();
function errorHandler(diagnostic: CompilerDiagnostics): ErrorHandlerResult {
  if (diagnostic.location)
    errors.set(diagnostic.location, diagnostic);
  return "Fail";
}

function runTest(name: string, code: string): boolean {
  console.log(chalk.inverse(name));
  try {
    let serialized = prepack(code, {
      filename: name,
      internalDebug: true,
      compatibility: "jsc-600-1-4-17",
      mathRandomSeed: "0",
      serialize: true,
      speculate: true,
    },
    errorHandler);
    if (!serialized) {
      console.log(chalk.red("Error during serialization"));
      return false;
    } else {
      return true;
    }
  } catch (e) {
    console.log(e);
    return false;
  } finally {
    for (let [loc, error] of errors) {
      console.log(`${loc.start.line}:${loc.start.column + 1} ${error.errorCode} ${error.message}`);
    }
  }
}

function run() {
  let failed = 0;
  let passed = 0;
  let total  = 0;

  for (let test of tests) {
    // filter hidden files
    if (path.basename(test.name)[0] === ".") continue;
    if (test.name.endsWith("~")) continue;

    total++;
    if (runTest(test.name, test.file))
      passed++;
    else
      failed++;
  }

  console.log("Passed:", `${passed}/${total}`, (Math.round((passed / total) * 100) || 0) + "%");
  return failed === 0;
}

if (!run())
  process.exit(1);
