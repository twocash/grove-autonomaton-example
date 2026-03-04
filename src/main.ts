import { createInterface } from 'node:readline';
import { readFileSync, appendFileSync, existsSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { PipelineContext, RoutingConfig, ZonesConfig } from './types.js';
import { execute } from './pipeline.js';

// Resolve paths relative to project root (one level up from src/)
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = resolve(__dirname, '..');
const CONFIG_DIR = resolve(PROJECT_ROOT, 'config');

// ANSI codes
const BOLD = '\x1b[1m';
const CYAN = '\x1b[36m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RED = '\x1b[31m';
const GRAY = '\x1b[90m';
const RESET = '\x1b[0m';

function loadConfig<T>(filename: string): T {
  const path = resolve(CONFIG_DIR, filename);
  return JSON.parse(readFileSync(path, 'utf-8')) as T;
}

function printBanner(): void {
  console.log(`
${CYAN}╭─────────────────────────────────────────────────╮${RESET}
${CYAN}│${RESET}  ${BOLD}GROVE AUTONOMATON v0.1${RESET}                          ${CYAN}│${RESET}
${CYAN}│${RESET}  Personal CLI Assistant                           ${CYAN}│${RESET}
${CYAN}│${RESET}                                                   ${CYAN}│${RESET}
${CYAN}│${RESET}  Type natural language requests.                   ${CYAN}│${RESET}
${CYAN}│${RESET}  Watch me learn and earn autonomy.                 ${CYAN}│${RESET}
${CYAN}│${RESET}                                                   ${CYAN}│${RESET}
${CYAN}│${RESET}  ${GRAY}Cognitive Router tiers:${RESET}                         ${CYAN}│${RESET}
${CYAN}│${RESET}    ${BOLD}[T0]${RESET} Sovereign Compute ${GRAY}(free, private)${RESET}        ${CYAN}│${RESET}
${CYAN}│${RESET}    ${BOLD}[T1]${RESET} Local Heuristic ${GRAY}(free, no LLM)${RESET}          ${CYAN}│${RESET}
${CYAN}│${RESET}    ${BOLD}[T2]${RESET} Standard LLM ${GRAY}(cheap, fast)${RESET}              ${CYAN}│${RESET}
${CYAN}│${RESET}    ${BOLD}[T3]${RESET} Apex Agentic ${GRAY}(capable, expensive)${RESET}       ${CYAN}│${RESET}
${CYAN}│${RESET}                                                   ${CYAN}│${RESET}
${CYAN}│${RESET}  ${GRAY}Zone colors:${RESET}                                    ${CYAN}│${RESET}
${CYAN}│${RESET}    ${GREEN}GREEN${RESET}  = auto-execute                         ${CYAN}│${RESET}
${CYAN}│${RESET}    ${YELLOW}YELLOW${RESET} = needs your approval                   ${CYAN}│${RESET}
${CYAN}│${RESET}    ${RED}RED${RESET}    = surface only                          ${CYAN}│${RESET}
${CYAN}│${RESET}                                                   ${CYAN}│${RESET}
${CYAN}│${RESET}  ${GRAY}Type "help" for commands, "quit" to exit${RESET}        ${CYAN}│${RESET}
${CYAN}╰─────────────────────────────────────────────────╯${RESET}
`);
}

function displayResult(ctx: PipelineContext): void {
  if (ctx.skillResult) {
    const prefix = ctx.skillResult.success ? `  ${GREEN}→${RESET}` : `  ${RED}✗${RESET}`;
    for (const line of ctx.skillResult.output.split('\n')) {
      console.log(`${prefix} ${line}`);
    }
  } else if (!ctx.approved && ctx.zone !== 'red') {
    console.log(`  ${GRAY}(skipped — not approved)${RESET}`);
  }
  console.log();
}

function appendTelemetry(event: Record<string, unknown>): void {
  const logPath = resolve(CONFIG_DIR, 'telemetry.log');
  appendFileSync(logPath, JSON.stringify(event) + '\n');
}

async function askYesNo(rl: ReturnType<typeof createInterface>, question: string): Promise<boolean> {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer.trim().toLowerCase().startsWith('y'));
    });
  });
}

async function main(): Promise<void> {
  // Ensure config directory exists
  if (!existsSync(CONFIG_DIR)) {
    mkdirSync(CONFIG_DIR, { recursive: true });
  }

  const routingConfig = loadConfig<RoutingConfig>('routing.config.json');
  const zonesConfig = loadConfig<ZonesConfig>('zones.schema.json');

  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  printBanner();

  const prompt = (): void => {
    rl.question(`${CYAN}grove>${RESET} `, async (input) => {
      const trimmed = input.trim();

      if (!trimmed) {
        prompt();
        return;
      }

      if (trimmed === 'quit' || trimmed === 'exit') {
        console.log(`\n${GRAY}Goodbye. Your compiled skills are saved in config/routing.config.json${RESET}\n`);
        rl.close();
        process.exit(0);
      }

      try {
        const ctx = await execute(trimmed, {
          routingConfig,
          zonesConfig,
          configDir: CONFIG_DIR,
          askApproval: async (ctx: PipelineContext) => {
            return askYesNo(rl, `  Approve? (y/n): `);
          },
          askUser: async (question: string) => {
            return askYesNo(rl, question);
          },
          appendTelemetry,
        });

        displayResult(ctx);
      } catch (err) {
        console.error(`  ${RED}Error: ${(err as Error).message}${RESET}\n`);
      }

      prompt();
    });
  };

  prompt();
}

main();
