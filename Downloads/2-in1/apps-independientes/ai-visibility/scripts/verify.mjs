#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';

const CHECKS = [
  { name: 'Lint', command: ['npm', 'run', 'lint'] },
  { name: 'Typecheck', command: ['npm', 'run', 'typecheck'] },
  { name: 'Unit tests', command: ['npm', 'run', 'test'] },
  { name: 'Smoke tests', command: ['npm', 'run', 'test:smoke'] }
];

const KPI_TEST_FILE = '__tests__/kpi.logic.test.ts';

function runStep(name, command) {
  console.log(`\n▶ ${name}`);
  console.log(`$ ${command.join(' ')}`);

  const result = spawnSync(command[0], command.slice(1), {
    stdio: 'inherit',
    shell: true
  });

  if (result.status !== 0) {
    console.error(`\n✖ ${name} failed.`);
    process.exit(result.status ?? 1);
  }

  console.log(`✔ ${name} passed.`);
}

for (const check of CHECKS) {
  runStep(check.name, check.command);
}

if (existsSync(KPI_TEST_FILE)) {
  runStep('KPI logic tests', ['npm', 'run', 'test:kpi']);
} else {
  console.log(`\nℹ KPI logic tests skipped (missing ${KPI_TEST_FILE}).`);
  console.log('  Add KPI tests at that path to enforce KPI gates in verify.');
}

console.log('\n✅ Verification suite completed successfully.');
