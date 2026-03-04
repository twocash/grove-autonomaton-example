import { readdirSync } from 'node:fs';
import type { SkillResult } from './types.js';

const SKILLS: Record<string, (input: string) => SkillResult> = {
  'builtin:time': () => ({
    output: new Date().toLocaleTimeString(),
    success: true,
  }),

  'builtin:date': () => ({
    output: new Date().toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }),
    success: true,
  }),

  'builtin:math': (input: string) => {
    // Extract math expression — strip everything except digits and operators
    const expr = input.replace(/[^0-9+\-*/().% ]/g, '').trim();
    if (!expr) return { output: 'No math expression found. Try: "2 + 2"', success: false };
    try {
      const result = new Function(`"use strict"; return (${expr})`)();
      if (typeof result !== 'number' || !isFinite(result)) {
        return { output: 'Invalid expression', success: false };
      }
      return { output: String(result), success: true };
    } catch {
      return { output: 'Could not evaluate expression', success: false };
    }
  },

  'builtin:ls': () => {
    try {
      const files = readdirSync('.').sort().join('\n');
      return { output: files || '(empty directory)', success: true };
    } catch (err) {
      return { output: `Error listing directory: ${(err as Error).message}`, success: false };
    }
  },

  'builtin:echo': (input: string) => {
    const msg = input.replace(/^(echo|say|repeat)\s*/i, '');
    return { output: msg || '(empty)', success: true };
  },

  'builtin:help': () => ({
    output: [
      'Available built-in commands:',
      '  time     — current time',
      '  date     — current date',
      '  math     — evaluate expressions (e.g. "2 + 2")',
      '  ls       — list files in current directory',
      '  echo     — repeat back your message',
      '  help     — this message',
      '',
      'Or ask anything — with an LLM API key, novel requests go to Tier 2/3.',
      'Repeat a command 3 times to trigger the skill flywheel!',
    ].join('\n'),
    success: true,
  }),
};

export function run(skillId: string, input: string): SkillResult {
  const handler = SKILLS[skillId];
  if (!handler) return { output: `Unknown skill: ${skillId}`, success: false };
  return handler(input);
}

export function isBuiltinSkill(skillId: string): boolean {
  return skillId in SKILLS;
}
