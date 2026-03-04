import type { Zone, ZonesConfig } from './types.js';

// ANSI color codes
const COLORS: Record<Zone, string> = {
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
};
const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';

export function getZone(skillId: string, config: ZonesConfig): Zone {
  if (config.zones.green.skills.includes(skillId)) return 'green';
  if (config.zones.red.skills.includes(skillId)) return 'red';
  if (config.zones.yellow.skills.includes(skillId)) return 'yellow';
  return config.defaultZone as Zone;
}

export function zoneColor(zone: Zone): string {
  return COLORS[zone];
}

export function zoneLabel(zone: Zone, config: ZonesConfig): string {
  return config.zones[zone].label;
}

export function formatZone(zone: Zone, config: ZonesConfig): string {
  return `${COLORS[zone]}${BOLD}[${config.zones[zone].label.toUpperCase()}]${RESET}`;
}

export function requiresApproval(zone: Zone, config: ZonesConfig): boolean {
  return config.zones[zone].requiresApproval;
}
