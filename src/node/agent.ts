/**
 * The reader's own coding agent, for `novon translate`, `migrate --agent`,
 * `eval` and `skill --agent`. novon never calls a hosted model: it builds a
 * prompt and runs a command already on the machine.
 *
 * Resolution: `NOVON_AGENT`, then config `agent`, then the first known agent
 * CLI on PATH.
 */
import { spawn } from 'node:child_process'

export type AgentSetting = string | { command: string; args?: string[] }

export interface Agent {
  /** Short name for messages, e.g. `claude`. */
  name: string
  command: string
  /** Arguments before the prompt. A `{prompt}` argument is replaced by it. */
  args: string[]
  /** Arguments added when the agent may edit files in its working folder. */
  editArgs: string[]
  /** How the prompt is passed: as the last argument, or on standard input. */
  input: 'arg' | 'stdin'
  /** Where the setting came from. */
  from: 'env' | 'config' | 'path'
}

/** Known agent CLIs, in the order they are looked for, with their one-shot (print) mode. */
export const KNOWN_AGENTS: { name: string; args: string[]; editArgs: string[] }[] = [
  { name: 'claude', args: ['-p'], editArgs: ['--permission-mode', 'acceptEdits'] },
  { name: 'codex', args: ['exec'], editArgs: ['--full-auto'] },
  { name: 'gemini', args: ['-p'], editArgs: ['--yolo'] },
  { name: 'opencode', args: ['run'], editArgs: [] },
  { name: 'cursor-agent', args: ['-p'], editArgs: ['--force'] },
  { name: 'aider', args: ['--yes-always', '--message'], editArgs: [] },
]

/** `claude -p "two words"` → `['claude', '-p', 'two words']`. */
export function splitCommand(line: string): string[] {
  const out: string[] = []
  let cur = ''
  let quote: string | null = null
  let started = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (quote) {
      if (c === quote) quote = null
      else if (c === '\\' && quote === '"' && i + 1 < line.length) cur += line[++i]
      else cur += c
    } else if (c === '"' || c === "'") {
      quote = c
      started = true
    } else if (/\s/.test(c)) {
      if (started) out.push(cur)
      cur = ''
      started = false
    } else {
      cur += c
      started = true
    }
  }
  if (started) out.push(cur)
  return out
}

function fromSetting(setting: AgentSetting, from: Agent['from']): Agent | null {
  const parts = typeof setting === 'string' ? splitCommand(setting) : [setting.command, ...(setting.args ?? [])]
  const [command, ...args] = parts
  if (!command) return null
  const name = command.split('/').at(-1)!
  const known = KNOWN_AGENTS.find((k) => k.name === name)
  // A bare known name (`NOVON_AGENT=codex`) gets its print-mode arguments.
  if (known && !args.length) return { name, command, args: known.args, editArgs: known.editArgs, input: 'arg', from }
  return { name, command, args, editArgs: known?.editArgs ?? [], input: args.includes('{prompt}') || known ? 'arg' : 'stdin', from }
}

/** The agent to use, or null when none is set and none is on PATH. */
export function resolveAgent(configured?: AgentSetting, env: Record<string, string | undefined> = process.env): Agent | null {
  if (env.NOVON_AGENT?.trim()) return fromSetting(env.NOVON_AGENT, 'env')
  if (configured) return fromSetting(configured, 'config')
  for (const k of KNOWN_AGENTS) {
    const path = Bun.which(k.name, env.PATH ? { PATH: env.PATH } : undefined)
    if (path) return { name: k.name, command: path, args: k.args, editArgs: k.editArgs, input: 'arg', from: 'path' }
  }
  return null
}

export const NO_AGENT = `No coding agent found. Install one of ${KNOWN_AGENTS.map((k) => k.name).join(', ')}, set NOVON_AGENT to a command, or set \`agent\` in novon.config.ts. --dry-run prints the prompt without one.`

/** A prompt longer than this goes on standard input: one argument is limited to 128 kB on Linux. */
const MAX_ARG = 100_000

/** The command line that would run, for `--dry-run` and messages. */
export function commandLine(agent: Agent, opts: { edit?: boolean } = {}): string {
  const args = [...agent.args, ...(opts.edit ? agent.editArgs : [])]
  return [agent.command, ...args.map((a) => (a === '{prompt}' ? '<prompt>' : /\s/.test(a) ? JSON.stringify(a) : a)), ...(agent.input === 'arg' && !args.includes('{prompt}') ? ['<prompt>'] : [])].join(' ')
}

export interface AgentRun {
  ok: boolean
  code: number
  stdout: string
  stderr: string
}

/** Runs the agent once with a prompt and collects what it prints. */
export function runAgent(agent: Agent, prompt: string, opts: { cwd?: string; edit?: boolean; timeoutMs?: number } = {}): Promise<AgentRun> {
  let args = [...agent.args, ...(opts.edit ? agent.editArgs : [])]
  let stdin: string | null = null
  if (args.includes('{prompt}')) {
    if (prompt.length > MAX_ARG) {
      args = args.filter((a) => a !== '{prompt}')
      stdin = prompt
    } else args = args.map((a) => (a === '{prompt}' ? prompt : a))
  } else if (agent.input === 'arg' && prompt.length <= MAX_ARG) args.push(prompt)
  else stdin = prompt
  return new Promise((resolve) => {
    const child = spawn(agent.command, args, { cwd: opts.cwd, stdio: ['pipe', 'pipe', 'pipe'], env: process.env })
    let stdout = ''
    let stderr = ''
    const timer = opts.timeoutMs ? setTimeout(() => child.kill('SIGTERM'), opts.timeoutMs) : null
    child.stdout.on('data', (d) => (stdout += d))
    child.stderr.on('data', (d) => (stderr += d))
    child.on('error', (e) => {
      if (timer) clearTimeout(timer)
      resolve({ ok: false, code: -1, stdout, stderr: `${stderr}${e.message}` })
    })
    child.on('close', (code) => {
      if (timer) clearTimeout(timer)
      resolve({ ok: code === 0, code: code ?? -1, stdout, stderr })
    })
    child.stdin.on('error', () => {})
    child.stdin.end(stdin ?? '')
  })
}

/** An answer without a wrapping code fence the agent may have added. */
export function unfence(text: string): string {
  const t = text.trim()
  const m = t.match(/^(`{3,}|~{3,})[\w-]*\n([\s\S]*?)\n\1$/)
  return m ? m[2] : t
}
