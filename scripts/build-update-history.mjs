import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outputPath = resolve(repoRoot, 'client/data/update-history.json');
const separator = '\u001f';
const log = execFileSync('git', [
  'log', 'HEAD', '--reverse', '--date=iso-strict',
  `--format=%h${separator}%cI${separator}%s`,
], { cwd: repoRoot, encoding: 'utf8' });

function classify(subject) {
  const text = subject.toLowerCase();
  if (/^(feat|feature)(:|\b)/.test(text) || /^(add|introduce|integrate|wire|enable|activate|build|create)\b/.test(text)) return 'feature';
  if (/^(fix|bug)(:|\b)/.test(text) || /\b(fix|prevent|repair|stabilize)\b/.test(text)) return 'fix';
  if (/^(test|qa)(:|\b)/.test(text) || /screenshot|visual smoke|test coverage/.test(text)) return 'qa';
  if (/^(docs?|documentation)(:|\b)/.test(text) || /\b(readme|documentation)\b/.test(text)) return 'docs';
  if (/\b(design|redesign|layout|palette|visual|polish|refine|clean|tidy|align|style)\b/.test(text)) return 'design';
  return 'build';
}

const commits = log.trim().split('\n').filter(Boolean).map((line) => {
  const [hash, timestamp, subject] = line.split(separator);
  if (!hash || !timestamp || !subject) throw new Error(`Could not parse Git history row: ${line}`);
  return { hash, timestamp, subject, category: classify(subject) };
});
if (!commits.length) throw new Error('No commits found on HEAD; refusing to write an empty update archive.');

const archive = {
  source: 'git-commit-history',
  timestampField: 'committer-date',
  firstCommit: commits[0].timestamp,
  latestCommit: commits.at(-1).timestamp,
  latestHash: commits.at(-1).hash,
  count: commits.length,
  commits,
};
mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, `${JSON.stringify(archive, null, 2)}\n`, 'utf8');
console.log(`Wrote ${commits.length} commits through ${archive.latestHash} to ${outputPath}`);
