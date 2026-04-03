/**
 * Brain Plugin System — core interfaces
 *
 * Unified BrainTool / BrainPlugin contract that all tool sources
 * (builtin, MCP, CLI, custom) implement.
 */

// ── Context passed to every tool call ────────────────────────────

export interface BrainToolContext {
  tenantId: string;
  projectId: string;
  userId: string;
}

// ── Single tool exposed by a plugin ──────────────────────────────

export interface BrainTool {
  /** Unique name, e.g. "task_list" */
  name: string;
  /** Human-readable description shown to LLM */
  description: string;
  /** JSON Schema for tool input */
  inputSchema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
  /** If set, tool execution is gated by RBAC check */
  requiredPermission?: { resource: string; action: string };
  /** Execute the tool and return a JSON-serialisable result */
  call(input: Record<string, unknown>, ctx: BrainToolContext): Promise<unknown>;
}

// ── Plugin that bundles one or more tools ────────────────────────

export type PluginType = 'builtin' | 'mcp' | 'cli' | 'custom';

export interface BrainPlugin {
  /** Globally unique id, e.g. "builtin:tasks", "cli:lark" */
  id: string;
  /** Display name */
  name: string;
  /** Plugin category */
  type: PluginType;
  /** Tools provided by this plugin */
  tools: BrainTool[];
  /** Called once when the plugin is registered */
  initialize(config: Record<string, unknown>): Promise<void>;
  /** Called when the plugin is unregistered / app shuts down */
  destroy(): Promise<void>;
}

// ── Persisted record of a tool call inside a conversation ────────

export interface ToolCallRecord {
  toolUseId: string;
  toolName: string;
  input: Record<string, unknown>;
  result?: unknown;
  status: 'pending' | 'done' | 'error';
  error?: string;
}
