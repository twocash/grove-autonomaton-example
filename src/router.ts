import type { RouteDecision, RoutingConfig, Tier } from './types.js';

const DANGEROUS_WORDS = ['delete', 'remove', 'install', 'sudo', 'rm', 'kill', 'drop', 'destroy', 'format', 'wipe'];

export function normalize(input: string): string {
  return input.toLowerCase().replace(/[^\w\s+\-*/]/g, '').trim().replace(/\s+/g, ' ');
}

export function route(rawInput: string, config: RoutingConfig): RouteDecision {
  const normalized = normalize(rawInput);
  const words = normalized.split(/\s+/);

  // Tier 0: exact match on compiled skills
  for (const [id, skill] of Object.entries(config.tiers['0'].skills)) {
    if (skill.normalizedIntent === normalized) {
      return {
        tier: 0,
        skill: skill.handler,
        skillId: id,
        reason: `compiled pattern match → ${id}`,
        cost: config.tiers['0'].costPerCall,
      };
    }
  }

  // Tier 1: keyword matching
  for (const matcher of config.tiers['1'].matchers) {
    const matched = matcher.keywords.find(kw =>
      words.includes(kw) || normalized.includes(kw)
    );
    if (matched) {
      return {
        tier: 1,
        skill: matcher.skill,
        reason: `keyword match "${matched}" → ${matcher.skill}`,
        cost: config.tiers['1'].costPerCall,
      };
    }
  }

  // Tier 2/3: LLM required — route based on danger
  const dangerousMatch = DANGEROUS_WORDS.find(w => words.includes(w));
  if (dangerousMatch) {
    const provider = config.tiers['3'].provider;
    return {
      tier: 3,
      skill: 'llm:query',
      reason: `dangerous keyword "${dangerousMatch}" → apex routing`,
      cost: config.tiers['3'].costPerCall,
      provider: `${provider.name} (${provider.model})`,
    };
  }

  const provider = config.tiers['2'].provider;
  return {
    tier: 2,
    skill: 'llm:query',
    reason: 'novel request, no keyword match',
    cost: config.tiers['2'].costPerCall,
    provider: `${provider.name} (${provider.model})`,
  };
}

export function formatRouteBox(decision: RouteDecision, config: RoutingConfig): string {
  const CYAN = '\x1b[36m';
  const GRAY = '\x1b[90m';
  const BOLD = '\x1b[1m';
  const RESET = '\x1b[0m';

  const tierKey = String(decision.tier) as keyof RoutingConfig['tiers'];
  const tierConfig = config.tiers[tierKey];
  const tierName = tierConfig.name;

  const lines = [
    `${CYAN}┌─ Cognitive Router ${'─'.repeat(40)}┐${RESET}`,
    `${CYAN}│${RESET}  ${BOLD}Tier ${decision.tier}: ${tierName}${RESET}`,
    `${CYAN}│${RESET}  Cost: ${decision.cost}`,
    `${CYAN}│${RESET}  Why: ${decision.reason}`,
  ];

  if (decision.provider) {
    lines.push(`${CYAN}│${RESET}  Provider: ${decision.provider} ${GRAY}(configurable in routing.config.json)${RESET}`);
  }

  lines.push(`${CYAN}└${'─'.repeat(60)}┘${RESET}`);

  return lines.map(l => `  ${l}`).join('\n');
}
