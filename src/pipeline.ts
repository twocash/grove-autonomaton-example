import type { PipelineContext, RoutingConfig, ZonesConfig } from './types.js';
import { route, normalize, formatRouteBox } from './router.js';
import { getZone, requiresApproval, formatZone } from './zones.js';
import * as skills from './skills.js';
import { query as llmQuery } from './llm.js';
import { observe, type RecognizerDeps } from './recognizer.js';

export interface PipelineDeps {
  routingConfig: RoutingConfig;
  zonesConfig: ZonesConfig;
  configDir: string;
  askApproval: (ctx: PipelineContext) => Promise<boolean>;
  askUser: (question: string) => Promise<boolean>;
  appendTelemetry: (event: Record<string, unknown>) => void;
}

const BOLD = '\x1b[1m';
const RED = '\x1b[31m';
const RESET = '\x1b[0m';

export async function execute(rawInput: string, deps: PipelineDeps): Promise<PipelineContext> {
  const startTime = Date.now();

  // Stage 1: Telemetry — capture start
  // (logged at the end after all stages complete)

  // Stage 2: Recognition — normalize + route
  const normalizedIntent = normalize(rawInput);
  const routeDecision = route(rawInput, deps.routingConfig);

  // Stage 3: Routing — resolve zone
  const zone = routeDecision.tier === 0
    ? 'green' as const
    : getZone(routeDecision.skill, deps.zonesConfig);

  const ctx: PipelineContext = {
    rawInput,
    normalizedIntent,
    route: routeDecision,
    zone,
    approved: false,
    startTime,
  };

  // Display the cognitive router decision box
  console.log('\n' + formatRouteBox(routeDecision, deps.routingConfig));

  // Stage 4: Approval — check zone
  if (zone === 'green') {
    ctx.approved = 'auto';
    const latency = Date.now() - startTime;
    console.log(`  ${formatZone(zone, deps.zonesConfig)} ⚡ Auto-executed (${latency}ms)`);
  } else if (zone === 'red') {
    ctx.approved = false;
    console.log(`  ${formatZone(zone, deps.zonesConfig)} ${RED}${BOLD}⚠ Red zone — surface only, will not execute${RESET}`);
  } else {
    // Yellow zone — ask for approval
    console.log(`  ${formatZone(zone, deps.zonesConfig)}`);
    ctx.approved = await deps.askApproval(ctx);
  }

  // Stage 5: Execution
  if (ctx.approved) {
    if (routeDecision.skill === 'llm:query') {
      const tierKey = String(routeDecision.tier) as '2' | '3';
      const provider = deps.routingConfig.tiers[tierKey].provider;
      ctx.skillResult = await llmQuery(rawInput, provider);
    } else {
      ctx.skillResult = skills.run(routeDecision.skill, rawInput);
    }
  } else if (zone === 'red') {
    // Red zone: provide info about the request without executing
    ctx.skillResult = {
      output: 'This request involves potentially dangerous operations. I can explain how, but won\'t execute it.',
      success: true,
    };
  }

  // Post: record telemetry
  const latencyMs = Date.now() - startTime;
  deps.appendTelemetry({
    ts: new Date().toISOString(),
    event: 'request',
    input: rawInput,
    normalizedIntent,
    tier: routeDecision.tier,
    zone,
    skill: routeDecision.skill,
    provider: routeDecision.provider,
    cost: routeDecision.cost,
    approved: ctx.approved,
    latencyMs,
  });

  // Post: check pattern recognition for flywheel
  const recognizerDeps: RecognizerDeps = {
    configDir: deps.configDir,
    routingConfig: deps.routingConfig,
    zonesConfig: deps.zonesConfig,
    askUser: deps.askUser,
    appendTelemetry: deps.appendTelemetry,
  };
  await observe(ctx, recognizerDeps);

  return ctx;
}
