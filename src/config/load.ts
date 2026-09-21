import fs from 'node:fs/promises';
import path from 'node:path';
import YAML from 'yaml';
import {
  rulesSchema,
  sourcesFileSchema,
  type NewsSource,
  type Rules,
} from './schema.js';

async function readYaml(filePath: string): Promise<unknown> {
  const raw = await fs.readFile(path.resolve(filePath), 'utf8');
  return YAML.parse(raw);
}

async function writeYaml(filePath: string, value: unknown) {
  const resolved = path.resolve(filePath);
  await fs.mkdir(path.dirname(resolved), { recursive: true });
  const temp = `${resolved}.tmp`;
  await fs.writeFile(temp, YAML.stringify(value, { lineWidth: 0 }), 'utf8');
  await fs.rename(temp, resolved);
}

export async function loadSources(filePath: string) {
  return sourcesFileSchema.parse(await readYaml(filePath)).sources;
}

export async function saveSources(filePath: string, sources: NewsSource[]) {
  const validated = sourcesFileSchema.parse({ sources });
  await writeYaml(filePath, validated);
  return validated.sources;
}

export async function loadRules(filePath: string) {
  return rulesSchema.parse(await readYaml(filePath));
}

export async function saveRules(filePath: string, rules: Rules) {
  const validated = rulesSchema.parse(rules);
  await writeYaml(filePath, validated);
  return validated;
}
