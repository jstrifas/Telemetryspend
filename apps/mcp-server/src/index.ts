import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type CallToolResult,
  type Tool,
} from '@modelcontextprotocol/sdk/types.js';
import { Transform } from 'node:stream';
import { z } from 'zod';
import {
  AnalyzeCardinalityInputSchema,
  CompareVendorsInputSchema,
  EstimateCostInputSchema,
  IMPLEMENTED_VENDORS,
  SuggestOptimizationsInputSchema,
  analyzeCardinalityImpact,
  buildVendorComparison,
  estimateCost,
  suggestOptimizations,
} from '@telemetryspend/cost-engine';

interface ToolDefinition<S extends z.ZodType> {
  name: string;
  description: string;
  inputSchema: S;
  /** Strings are returned as plain text; anything else is serialized as JSON. */
  handler: (input: z.infer<S>) => unknown;
}

function defineTool<S extends z.ZodType>(tool: ToolDefinition<S>): ToolDefinition<S> {
  return tool;
}

const tools = [
  defineTool({
    name: 'estimate_observability_cost',
    description:
      'Estimates monthly observability cost for a given vendor based on a telemetry profile (log volume, trace retention, metric cardinality).',
    inputSchema: EstimateCostInputSchema,
    handler: ({ vendor, ...profile }) =>
      IMPLEMENTED_VENDORS.includes(vendor)
        ? estimateCost(profile, vendor)
        : `Vendor ${vendor} not implemented until Stage 4.`,
  }),
  defineTool({
    name: 'compare_vendors',
    description:
      'Compares monthly observability costs across Datadog, Grafana Cloud, AWS CloudWatch, and Honeycomb for a given telemetry profile.',
    inputSchema: CompareVendorsInputSchema,
    handler: (profile) => buildVendorComparison(profile),
  }),
  defineTool({
    name: 'analyze_cardinality_impact',
    description:
      'Calculates the cost impact of adding a high-cardinality tag (like user_id or container_id) to metrics. Warns about time-series explosion.',
    inputSchema: AnalyzeCardinalityInputSchema,
    handler: ({ proposed_tag, estimated_unique_values, ...profile }) =>
      analyzeCardinalityImpact(profile, proposed_tag, estimated_unique_values),
  }),
  defineTool({
    name: 'suggest_optimizations',
    description:
      'Suggests cost-saving optimizations for an observability setup — trace sampling, log retention adjustments, high-cardinality tag stripping — with estimated savings.',
    inputSchema: SuggestOptimizationsInputSchema,
    handler: ({ current_monthly_cost_usd, ...profile }) => suggestOptimizations(profile, current_monthly_cost_usd),
  }),
];

const toolsByName = new Map<string, ToolDefinition<z.ZodType>>(
  tools.map((tool) => [tool.name, tool as ToolDefinition<z.ZodType>]),
);

function toJsonSchema(schema: z.ZodType): Tool['inputSchema'] {
  const { $schema: _ignored, ...jsonSchema } = z.toJSONSchema(schema, { io: 'input' });
  return jsonSchema as Tool['inputSchema'];
}

const server = new Server(
  { name: 'telemetryspend', version: '0.1.0' },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: tools.map(
    (tool): Tool => ({
      name: tool.name,
      description: tool.description,
      inputSchema: toJsonSchema(tool.inputSchema),
    }),
  ),
}));

server.setRequestHandler(CallToolRequestSchema, async (request): Promise<CallToolResult> => {
  const tool = toolsByName.get(request.params.name);
  if (!tool) {
    return { isError: true, content: [{ type: 'text', text: `Unknown tool: ${request.params.name}` }] };
  }

  const parsed = tool.inputSchema.safeParse(request.params.arguments ?? {});
  if (!parsed.success) {
    return { isError: true, content: [{ type: 'text', text: `Invalid arguments:\n${z.prettifyError(parsed.error)}` }] };
  }

  const result = tool.handler(parsed.data);
  const text = typeof result === 'string' ? result : JSON.stringify(result, null, 2);
  return { content: [{ type: 'text', text }] };
});

// Surface protocol errors (e.g. unparseable input) instead of dropping them silently.
server.onerror = (error) => console.error('telemetryspend MCP error:', error);

/**
 * Drops a leading UTF-8 byte-order mark. Windows PowerShell 5.1 prepends one
 * when piping text into a process, which makes the first JSON-RPC message
 * unparseable. MCP clients never send one, so this only affects manual testing.
 */
function stripLeadingBom(): Transform {
  let checked = false;
  return new Transform({
    transform(chunk: Buffer, _encoding, callback) {
      if (!checked) {
        checked = true;
        if (chunk[0] === 0xef && chunk[1] === 0xbb && chunk[2] === 0xbf) chunk = chunk.subarray(3);
      }
      callback(null, chunk);
    },
  });
}

async function main() {
  const transport = new StdioServerTransport(process.stdin.pipe(stripLeadingBom()), process.stdout);
  await server.connect(transport);
  // stdout is the MCP channel; diagnostics go to stderr.
  console.error('telemetryspend MCP server running on stdio');
}

main().catch((error) => {
  console.error('Fatal error starting telemetryspend MCP server:', error);
  process.exit(1);
});
