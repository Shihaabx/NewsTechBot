import fs from 'node:fs/promises';
import path from 'node:path';
import YAML from 'yaml';
import { rulesSchema, sourcesFileSchema } from './schema.js';

async function readYaml(filePath: string): Promise<unknown> {
  const raw = await fs.readFile(path.resolve(filePath), 'utf8');
  return YAML.parse(raw);
}

export async function loadSources(filePath: string) {
  return sourcesFileSchema.parse(await readYaml(filePath)).sources;
}

export async function loadRules(filePath: string) {
  return rulesSchema.parse(await readYaml(filePath));
}
