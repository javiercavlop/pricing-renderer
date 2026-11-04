// In-memory "subscription" of the demo. A module-level Map is enough for an example: it is shared
// by the requests of one server process, starts from the same value on every start and is lost on
// restart. A real app reads the signed-in customer's contract from its own backend.
// The demo has no authentication or CSRF protection; a real app must add both.
export const dynamic = 'force-dynamic';

interface Subscription {
  planId: string;
  billingPeriod: string;
  addOns: Record<string, { selected: boolean; quantity: number }>;
}

const PLAN_IDS = new Set(['starter', 'growth']);
const BILLING_PERIODS = new Set(['monthly', 'yearly']);
// The add-ons of the demo YAML (pricing-yaml.ts): the plans each is available for and its
// maxQuantity.
const ADD_ONS = new Map<string, { availableFor: readonly string[]; maxQuantity: number }>([
  ['extraStorage', { availableFor: ['growth'], maxQuantity: 10 }],
]);

const state = new Map<string, Subscription>([
  ['current', { planId: 'starter', billingPeriod: 'monthly', addOns: {} }],
]);

function current(): Subscription {
  return state.get('current') as Subscription;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

// Reads the request body into a known subscription; anything else is refused, never stored.
function parseSubscription(body: unknown): Subscription | undefined {
  if (!isRecord(body)) return undefined;
  const { planId, billingPeriod, addOns } = body;
  if (typeof planId !== 'string' || !PLAN_IDS.has(planId)) return undefined;
  if (typeof billingPeriod !== 'string' || !BILLING_PERIODS.has(billingPeriod)) return undefined;
  const parsed: Subscription = { planId, billingPeriod, addOns: {} };
  if (addOns === undefined) return parsed;
  if (!isRecord(addOns)) return undefined;
  for (const [id, entry] of Object.entries(addOns)) {
    const addOn = ADD_ONS.get(id);
    if (addOn === undefined || !isRecord(entry)) return undefined;
    const { selected, quantity } = entry;
    if (typeof selected !== 'boolean') return undefined;
    if (typeof quantity !== 'number' || !Number.isInteger(quantity) || quantity < 1) {
      return undefined;
    }
    if (quantity > addOn.maxQuantity) return undefined;
    if (selected) {
      if (!addOn.availableFor.includes(planId)) return undefined;
      parsed.addOns[id] = { selected, quantity };
    }
  }
  return parsed;
}

export function GET() {
  return Response.json(current(), { headers: { 'cache-control': 'no-store' } });
}

export async function POST(request: Request) {
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) {
    return Response.json({ error: 'Content-Type must be application/json' }, { status: 415 });
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const next = parseSubscription(body);
  if (next === undefined) return Response.json({ error: 'Invalid subscription' }, { status: 422 });
  state.set('current', next);
  return Response.json(next, { headers: { 'cache-control': 'no-store' } });
}
