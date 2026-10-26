import { stringify } from 'yaml';

// Deterministic synthetic Pricing2Yaml documents that reproduce the extremes the SPECTRA review
// found in real pricings (see README.md in this directory). Nothing is random at run time: every
// document is a pure function of its shape, currency and billing period, so the same pricing is
// built in vitest and in Playwright.

export type StressShape = 'okta' | 'zoom' | 'clickup' | 'webflow' | 'salesforce' | 'github';
export type StressCurrency = 'EUR' | 'USD';
export type StressPeriod = 'monthly' | 'annual';

export interface StressCounts {
  plans: number;
  features: number;
  usageLimits: number;
  addOns: number;
}

export interface StressFixture {
  id: string;
  shape: StressShape;
  currency: StressCurrency;
  period: StressPeriod;
  counts: StressCounts;
}

interface ShapeConfig {
  brand: string;
  seed: number;
  counts: StressCounts;
  // Real SPECTRA pricings of okta, zoom and clickup carry no feature tags (one big group).
  tagged: boolean;
  planUnit: string;
  basePrice: number;
  priceStep: number;
  planNames: string[];
}

const shapes: Record<StressShape, ShapeConfig> = {
  okta: {
    brand: 'Nimbus Identity',
    seed: 11,
    counts: { plans: 0, features: 140, usageLimits: 1, addOns: 18 },
    tagged: false,
    planUnit: 'user/month',
    basePrice: 2,
    priceStep: 1.5,
    planNames: [],
  },
  zoom: {
    brand: 'Orbit Meetings',
    seed: 23,
    counts: { plans: 4, features: 143, usageLimits: 6, addOns: 16 },
    tagged: false,
    planUnit: 'host/month',
    basePrice: 14.99,
    priceStep: 1.35,
    planNames: ['Basic', 'Pro', 'Business', 'Business Plus'],
  },
  clickup: {
    brand: 'Taskforge',
    seed: 37,
    counts: { plans: 5, features: 136, usageLimits: 38, addOns: 4 },
    tagged: false,
    planUnit: 'member/month',
    basePrice: 7,
    priceStep: 1.7,
    planNames: ['Free Forever', 'Unlimited', 'Business', 'Business Plus', 'Enterprise'],
  },
  webflow: {
    brand: 'Sitecraft',
    seed: 41,
    counts: { plans: 15, features: 90, usageLimits: 12, addOns: 8 },
    tagged: true,
    planUnit: 'site/month',
    basePrice: 14,
    priceStep: 1.25,
    planNames: [
      'Starter',
      'Basic hosting',
      'CMS hosting',
      'Business hosting',
      'Enterprise hosting',
      'Ecommerce Standard',
      'Ecommerce Plus',
      'Ecommerce Advanced',
      'Core workspace',
      'Growth workspace',
      'Freelancer workspace',
      'Agency workspace',
      'Partner workspace',
      'Enterprise workspace',
      'Enterprise ecommerce',
    ],
  },
  salesforce: {
    brand: 'Cloudforce CRM',
    seed: 53,
    counts: { plans: 6, features: 120, usageLimits: 8, addOns: 14 },
    tagged: true,
    planUnit: 'user/month',
    basePrice: 25,
    priceStep: 1.9,
    planNames: [
      'Starter Suite',
      'Pro Suite',
      'Enterprise',
      'Unlimited',
      'Einstein 1 Sales',
      'Einstein 1 Service',
    ],
  },
  github: {
    brand: 'Codehub',
    seed: 67,
    counts: { plans: 4, features: 80, usageLimits: 10, addOns: 14 },
    tagged: true,
    planUnit: 'user/month',
    basePrice: 4,
    priceStep: 5,
    planNames: ['Free', 'Team', 'Enterprise', 'Enterprise Cloud with data residency'],
  },
};

const currencies: StressCurrency[] = ['EUR', 'USD'];
const periods: StressPeriod[] = ['monthly', 'annual'];

const currencyFactor: Record<StressCurrency, number> = { EUR: 0.92, USD: 1 };
// The annual pricing lists the discounted price per month; the monthly period multiplies it back.
const periodFactor: Record<StressPeriod, number> = { monthly: 1, annual: 0.85 };
const billingByPeriod: Record<StressPeriod, Record<string, number>> = {
  monthly: { monthly: 1, annual: 0.85 },
  annual: { annual: 1, monthly: 1.18 },
};

export const stressFixtures: StressFixture[] = [];
for (const shape of Object.keys(shapes) as StressShape[]) {
  for (const currency of currencies) {
    for (const period of periods) {
      stressFixtures.push({
        id: `${shape}-${currency.toLowerCase()}-${period}`,
        shape,
        currency,
        period,
        counts: shapes[shape].counts,
      });
    }
  }
}

export function findStressFixture(id: string): StressFixture {
  const fixture = stressFixtures.find((candidate) => candidate.id === id);
  if (!fixture) throw new Error(`Stress fixture "${id}" was not found.`);
  return fixture;
}

// Text banks. Names are "<subject> <area>", so 20 x 8 = 160 distinct features at most.
const subjects = [
  'Single sign-on',
  'Multifactor authentication',
  'Audit log',
  'Role-based access',
  'Workflow automation',
  'Custom reporting',
  'Data export',
  'Sandbox environments',
  'API access',
  'Mobile app',
  'Email notifications',
  'Guest access',
  'Version history',
  'Approval workflows',
  'Data residency',
  'Priority support',
  'Admin console',
  'Webhooks',
  'Custom branding',
  'Integration marketplace',
];

const areas = [
  'for every team',
  'with granular policies',
  'across all workspaces',
  'for external collaborators',
  'including historical records',
  'with scheduled delivery',
  'for regulated industries',
  'with a dedicated environment',
];

const openers = [
  'gives administrators control over how',
  'keeps teams aligned on how',
  'lets workspace owners decide when',
  'helps security and compliance teams verify that',
  'removes manual work whenever',
];

const details = [
  'members are provisioned, reviewed and removed across every connected application',
  'changes are recorded with the author, the timestamp and the previous value',
  'notifications reach the right people without flooding shared channels',
  'content stays available to external collaborators only while a project requires it',
  'reports can be scheduled, exported and shared with people who have no account',
];

const closers = [
  'Available on the plans listed in this comparison; limits apply per workspace.',
  'Configuration changes take effect immediately and can be reverted at any time.',
  'Documentation and migration guides are included for every supported region.',
];

const featureTags = [
  'Collaboration',
  'Security and compliance',
  'Administration',
  'Automation',
  'Reporting and analytics',
  'Integrations',
  'Support and services',
  'Data and storage',
];

const featureTypes = ['DOMAIN', 'MANAGEMENT', 'AUTOMATION'];

const textLadder = [
  'Community forum and knowledge base',
  'Email support with a first response within one business day',
  'Chat and email support with a four-hour first response target on business days',
  'Dedicated technical account manager with 24/7 phone support and a one-hour response',
];

const resources = [
  ['Monthly active users', 'user'],
  ['Stored records', 'record'],
  ['API requests', 'request/month'],
  ['Automation runs', 'run/month'],
  ['Projects', 'project'],
  ['Custom fields', 'field'],
  ['Saved views', 'view'],
  ['Guest collaborators', 'guest'],
  ['File storage', 'GB'],
  ['Connected integrations', 'integration'],
  ['Dashboards', 'dashboard'],
  ['Scheduled reports', 'report'],
  ['Audit log retention', 'day'],
  ['Version history retention', 'day'],
  ['Sandbox environments', 'environment'],
  ['Webhook endpoints', 'endpoint'],
  ['Custom roles', 'role'],
  ['Workspaces', 'workspace'],
  ['Outbound emails', 'email/month'],
];

const limitLadder = [3, 10, 50, 250, 1000, 5000, 25000];

const audiences = [
  'individuals and small teams exploring the product with no commitment',
  'growing teams that need shared workspaces, automation and priority email support',
  'departments that must standardise processes, permissions and reporting across teams',
  'regulated organisations that need single sign-on, audit trails and data residency',
  'large enterprises that negotiate custom limits and dedicated infrastructure',
];

const planTail = 'Includes the capabilities, limits and support levels listed below.';

const addOnNames = [
  'Advanced security pack',
  'Premium support',
  'Extra storage block',
  'Additional workspace',
  'Single sign-on connector',
  'Data residency option',
  'Audit log streaming',
  'Sandbox environment',
  'Dedicated success manager',
  'Custom branding',
  'AI assistant',
  'Advanced analytics',
  'Extra automation runs',
  'Guest access bundle',
  'Compliance reports',
  'Training and onboarding',
  'Priority API access',
  'Migration service',
];

const addOnLeads = [
  'extends the plan you selected for teams that need',
  'adds a separately billed capability for organisations that need',
  'is an optional upgrade for customers that need',
];

const addOnNeeds = [
  'more capacity, stricter controls or faster answers than the included allowance provides',
  'to meet internal policies without moving to a larger plan',
  'tailored onboarding, predictable billing and a single point of contact',
];

const addOnUnits = ['user/month', 'pack/month', 'GB/month', 'workspace/month', 'month'];
const addOnPrices = [2, 5, 8, 12, 20, 35, 49];

function createRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function pick<T>(items: readonly T[], index: number): T {
  return items[index % items.length]!;
}

function choose<T>(items: readonly T[], random: () => number): T {
  return items[Math.floor(random() * items.length)]!;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function toId(name: string): string {
  const words = name.split(/[^A-Za-z0-9]+/).filter(Boolean);
  let id = '';
  for (const [position, word] of words.entries()) {
    const lower = word.toLowerCase();
    id += position === 0 ? lower : lower.charAt(0).toUpperCase() + lower.slice(1);
  }
  return id;
}

interface FeatureInfo {
  id: string;
  text: boolean;
  // First plan (by position) that includes the feature; equal to the plan count when none does.
  threshold: number;
}

function buildFeatures(config: ShapeConfig, random: () => number) {
  const features: Record<string, unknown> = {};
  const info: FeatureInfo[] = [];
  if (config.counts.features > subjects.length * areas.length) {
    throw new Error('Too many stress features requested.');
  }
  for (let index = 0; index < config.counts.features; index += 1) {
    const name = `${pick(subjects, index)} ${pick(areas, Math.floor(index / subjects.length))}`;
    const id = toId(name);
    const text = index % 6 === 5;
    const sentence = `${name} ${choose(openers, random)} ${choose(details, random)}.`;
    const feature: Record<string, unknown> = {
      name,
      description: `${sentence} ${choose(closers, random)}`,
      valueType: text ? 'TEXT' : 'BOOLEAN',
      defaultValue: text ? 'Not included' : false,
      type: pick(featureTypes, index),
    };
    if (config.tagged) feature.tag = pick(featureTags, index);
    features[id] = feature;
    info.push({ id, text, threshold: Math.floor(random() * (config.counts.plans + 1)) });
  }
  return { features, info };
}

function buildUsageLimits(config: ShapeConfig) {
  const limits: Record<string, unknown> = {};
  const ids: string[] = [];
  if (config.counts.usageLimits > resources.length * 2) {
    throw new Error('Too many stress usage limits requested.');
  }
  for (let index = 0; index < config.counts.usageLimits; index += 1) {
    const [resource, unit] = pick(resources, index) as [string, string];
    const name = index >= resources.length ? `${resource} per member` : resource;
    const id = toId(`use ${name}`);
    const lower = name.toLowerCase();
    const limit: Record<string, unknown> = {
      name,
      description: `Maximum number of ${lower} included before an upgrade or an add-on is needed.`,
      valueType: 'NUMERIC',
      defaultValue: 0,
      unit,
      type: unit.endsWith('/month') ? 'RENEWABLE' : 'NON_RENEWABLE',
    };
    if (config.tagged) limit.tag = 'Limits and quotas';
    limits[id] = limit;
    ids.push(id);
  }
  return { limits, ids };
}

function buildPlans(
  fixture: StressFixture,
  config: ShapeConfig,
  info: FeatureInfo[],
  limitIds: string[],
) {
  const plans: Record<string, unknown> = {};
  const ids: string[] = [];
  const count = config.counts.plans;
  const factor = currencyFactor[fixture.currency] * periodFactor[fixture.period];
  for (const [index, name] of config.planNames.entries()) {
    const planFeatures: Record<string, unknown> = {};
    for (const item of info) {
      if (index < item.threshold) continue;
      const value = item.text ? pick(textLadder, index - item.threshold) : true;
      planFeatures[item.id] = { value };
    }
    const planLimits: Record<string, unknown> = {};
    for (const [position, limitId] of limitIds.entries()) {
      const step = limitLadder[Math.min(index, limitLadder.length - 1)]!;
      planLimits[limitId] = { value: step * (1 + (position % 3)) };
    }
    let price: number | string = 0;
    if (index === count - 1 && count > 2) {
      price = 'Contact sales';
    } else if (index > 0) {
      const list = config.basePrice * Math.pow(config.priceStep, index - 1);
      price = round2(list * factor);
    }
    const id = toId(name);
    plans[id] = {
      name,
      description: `${name} is designed for ${pick(audiences, index)}. ${planTail}`,
      price,
      unit: config.planUnit,
      features: planFeatures,
      usageLimits: planLimits,
    };
    ids.push(id);
  }
  return { plans, ids };
}

function buildAddOns(
  fixture: StressFixture,
  config: ShapeConfig,
  random: () => number,
  planIds: string[],
  booleanFeatureIds: string[],
  limitIds: string[],
) {
  const addOns: Record<string, unknown> = {};
  const count = config.counts.addOns;
  if (count > addOnNames.length) throw new Error('Too many stress add-ons requested.');
  const names = addOnNames.slice(0, count);
  const ids = names.map((name) => toId(name));
  const factor = currencyFactor[fixture.currency] * periodFactor[fixture.period];
  for (const [index, name] of names.entries()) {
    const quote = index % 9 === 8;
    const granted: Record<string, unknown> = {};
    for (let offset = 0; offset < 2; offset += 1) {
      const slot = (index * 11 + offset * 5 + 3) % booleanFeatureIds.length;
      granted[booleanFeatureIds[slot]!] = { value: true };
    }
    const addOn: Record<string, unknown> = {
      name,
      description: `${name} ${choose(addOnLeads, random)} ${choose(addOnNeeds, random)}.`,
      availableFor: planIds.slice(index % 3 === 0 ? 0 : 1),
      price: quote ? 'Contact sales' : round2(pick(addOnPrices, index) * factor),
      unit: pick(addOnUnits, index),
      features: granted,
    };
    if (index % 5 === 4) addOn.dependsOn = [ids[index - 1]];
    if (index % 7 === 2 && index + 1 < ids.length) addOn.excludes = [ids[index + 1]];
    if (index % 4 === 1 && limitIds.length > 0) {
      addOn.usageLimitsExtensions = { [limitIds[index % limitIds.length]!]: { value: 10 } };
    }
    if (index % 3 === 0 && !quote) {
      addOn.subscriptionConstraints = { minQuantity: 1, maxQuantity: 100, quantityStep: 1 };
    }
    addOns[ids[index]!] = addOn;
  }
  return addOns;
}

export function buildStressPricing(fixture: StressFixture): Record<string, unknown> {
  const config = shapes[fixture.shape];
  if (config.planNames.length !== config.counts.plans) {
    throw new Error(`Stress shape "${fixture.shape}" has the wrong number of plan names.`);
  }
  const random = createRandom(config.seed);
  const { features, info } = buildFeatures(config, random);
  const { limits, ids: limitIds } = buildUsageLimits(config);
  const { plans, ids: planIds } = buildPlans(fixture, config, info, limitIds);
  const booleanFeatureIds = info.filter((item) => !item.text).map((item) => item.id);
  const addOns = buildAddOns(fixture, config, random, planIds, booleanFeatureIds, limitIds);
  return {
    syntaxVersion: '3.1',
    saasName: config.brand,
    version: '2026.1',
    createdAt: '2026-01-15',
    url: `https://example.com/pricing/${fixture.id}`,
    currency: fixture.currency,
    billing: billingByPeriod[fixture.period],
    variables: {},
    features,
    usageLimits: limits,
    plans: planIds.length === 0 ? null : plans,
    addOns,
    custom: {
      pricingRenderer: {
        title: `${config.brand} pricing for teams of every size`,
        subtitle: 'Compare plans, add-ons and usage limits side by side before you talk to sales.',
      },
    },
  };
}

export function buildStressYaml(fixture: StressFixture): string {
  return stringify(buildStressPricing(fixture), { lineWidth: 0 });
}
