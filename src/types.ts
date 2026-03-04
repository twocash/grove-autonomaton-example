export type Tier = 0 | 1 | 2 | 3;
export type Zone = 'green' | 'yellow' | 'red';

export interface ProviderConfig {
  name: string;
  model: string;
  apiKeyEnv: string;
  endpoint: string;
}

export interface CompiledSkill {
  pattern: string;
  normalizedIntent: string;
  handler: string;
  zone: Zone;
  compiledAt: string;
  invocations: number;
}

export interface KeywordMatcher {
  keywords: string[];
  skill: string;
}

export interface RoutingConfig {
  version: number;
  tiers: {
    '0': { name: string; description: string; costPerCall: string; skills: Record<string, CompiledSkill> };
    '1': { name: string; description: string; costPerCall: string; matchers: KeywordMatcher[] };
    '2': { name: string; description: string; costPerCall: string; provider: ProviderConfig };
    '3': { name: string; description: string; costPerCall: string; provider: ProviderConfig };
  };
}

export interface ZonesConfig {
  version: number;
  zones: {
    green: { label: string; color: string; description: string; requiresApproval: boolean; skills: string[] };
    yellow: { label: string; color: string; description: string; requiresApproval: boolean; skills: string[] };
    red: { label: string; color: string; description: string; requiresApproval: boolean; autoExecuteEligible: boolean; skills: string[] };
  };
  defaultZone: string;
}

export interface RouteDecision {
  tier: Tier;
  skill: string;
  skillId?: string;
  reason: string;
  cost: string;
  provider?: string;
}

export interface SkillResult {
  output: string;
  success: boolean;
}

export interface PipelineContext {
  rawInput: string;
  normalizedIntent: string;
  route: RouteDecision;
  zone: Zone;
  skillResult?: SkillResult;
  approved: boolean | 'auto';
  startTime: number;
}

export interface TelemetryEvent {
  ts: string;
  event: 'request' | 'pattern_detected' | 'skill_compiled' | 'zone_promotion';
  input?: string;
  normalizedIntent?: string;
  tier?: Tier;
  zone?: Zone;
  skill?: string;
  provider?: string;
  cost?: string;
  approved?: boolean | 'auto';
  latencyMs?: number;
  count?: number;
  action?: string;
  skillId?: string;
  promotedTo?: Zone;
}
