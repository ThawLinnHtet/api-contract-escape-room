import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import dotenv from 'dotenv';

const staged = execFileSync('git', ['diff', '--cached', '--name-only', '--diff-filter=ACMR', '-z'], { encoding: 'utf8' }).split('\0').filter(Boolean);
const credentials = ['.env.local', '.env'].filter(existsSync).flatMap(path => {
  const env = dotenv.parse(readFileSync(path));
  return ['DATABASE_URL', 'DATABASE_URL_UNPOOLED'].map(key => env[key]).filter((value): value is string => typeof value === 'string' && value.length > 25 && !value.includes('<'));
});

const failures = [];
for (const path of staged) {
  if (/(^|\/)\.env(?:\.|$)/.test(path) && !path.endsWith('.env.example')) failures.push(`${path}: private environment file`);
  if (/(^|\/)(?:\.neon|auth\.json|\.credentials\.json)$/.test(path)) failures.push(`${path}: local credentials or context`);
  const content = execFileSync('git', ['show', `:${path}`], { maxBuffer: 32 * 1024 * 1024 });
  if (credentials.some(value => content.includes(Buffer.from(value)))) failures.push(`${path}: contains a local database credential`);
}
if (failures.length) {
  console.error('Secret check failed (values withheld):\n' + failures.join('\n'));
  process.exit(1);
}
console.log(`Secret check passed for ${staged.length} staged files; local database credentials are excluded.`);
