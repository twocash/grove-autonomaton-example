import { randomBytes } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { CompiledSkill, PipelineContext, RoutingConfig, Tier, ZonesConfig } from './types.js';

interface IntentEntry {
  count: number;
  lastSkill: string;
  lastTier: Tier;
}

const intentCounts = new Map<string, IntentEntry>();
const PROMOTION_THRESHOLD = 3;

const BOLD = '\x1b[1m';
const CYAN = '\x1b[36m';
const GREEN = '\x1b[32m';
const RESET = '\x1b[0m';

export interface RecognizerDeps {
  configDir: string;
  routingConfig: RoutingConfig;
  zonesConfig: ZonesConfig;
  askUser: (question: string) => Promise<boolean>;
  appendTelemetry: (event: Record<string, unknown>) => void;
}

export async function observe(ctx: PipelineContext, deps: RecognizerDeps): Promise<void> {
  // Already a compiled Tier 0 skill — just bump its invocation counter
  if (ctx.route.tier === 0 && ctx.route.skillId) {
    const skill = deps.routingConfig.tiers['0'].skills[ctx.route.skillId];
    if (skill) {
      skill.invocations++;
      writeFileSync(
        resolve(deps.configDir, 'routing.config.json'),
        JSON.stringify(deps.routingConfig, null, 2),
      );
    }
    return;
  }

  // Only track patterns for skills that actually executed successfully
  if (!ctx.approved || !ctx.skillResult?.success) return;
  // Only track builtin skills (LLM responses are too varied to compile)
  if (ctx.route.skill.startsWith('llm:')) return;

  const key = ctx.normalizedIntent;
  const entry = intentCounts.get(key) || { count: 0, lastSkill: '', lastTier: 1 as Tier };
  entry.count++;
  entry.lastSkill = ctx.route.skill;
  entry.lastTier = ctx.route.tier;
  intentCounts.set(key, entry);

  if (entry.count === PROMOTION_THRESHOLD) {
    deps.appendTelemetry({
      ts: new Date().toISOString(),
      event: 'pattern_detected',
      normalizedIntent: key,
      count: entry.count,
      action: 'propose_skill',
    });

    console.log(`\n  ${CYAN}⚡ Pattern detected: "${key}" (${entry.count} occurrences)${RESET}`);
    const approve = await deps.askUser(
      `  Promote to ${GREEN}${BOLD}Sovereign Compute${RESET} (auto-execute, no approval needed)? (y/n): `,
    );

    if (approve) {
      compileSkill(key, entry, deps);
    }
  }
}

function compileSkill(intent: string, entry: IntentEntry, deps: RecognizerDeps): void {
  const skillId = 'sk_' + randomBytes(4).toString('hex');

  const compiled: CompiledSkill = {
    pattern: intent,
    normalizedIntent: intent,
    handler: entry.lastSkill,
    zone: 'green',
    compiledAt: new Date().toISOString(),
    invocations: entry.count,
  };

  // Add to Tier 0 in routing config
  deps.routingConfig.tiers['0'].skills[skillId] = compiled;
  writeFileSync(
    resolve(deps.configDir, 'routing.config.json'),
    JSON.stringify(deps.routingConfig, null, 2),
  );

  // Move skill to Green zone
  const zones = deps.zonesConfig;
  if (!zones.zones.green.skills.includes(entry.lastSkill)) {
    zones.zones.green.skills.push(entry.lastSkill);
  }
  zones.zones.yellow.skills = zones.zones.yellow.skills.filter(s => s !== entry.lastSkill);
  writeFileSync(
    resolve(deps.configDir, 'zones.schema.json'),
    JSON.stringify(zones, null, 2),
  );

  deps.appendTelemetry({
    ts: new Date().toISOString(),
    event: 'skill_compiled',
    skillId,
    normalizedIntent: intent,
    promotedTo: 'green',
  });

  console.log(`  ${GREEN}${BOLD}✓ Skill compiled: ${skillId} → Tier 0, Sovereign Compute${RESET}\n`);
}
