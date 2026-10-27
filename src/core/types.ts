export type UnknownRecord = Record<string, unknown>;

export type IPricingLike = UnknownRecord & {
  syntaxVersion?: unknown;
  saasName?: unknown;
  version?: unknown;
  createdAt?: unknown;
  url?: unknown;
  tags?: unknown;
  currency?: unknown;
  billing?: unknown;
  variables?: unknown;
  features?: unknown;
  usageLimits?: unknown;
  plans?: unknown;
  addOns?: unknown;
  custom?: unknown;
};

export type DiagnosticSeverity = 'info' | 'warning' | 'error';

export interface PricingDiagnostic {
  code: string;
  severity: DiagnosticSeverity;
  message: string;
  path?: string;
  details?: UnknownRecord;
}

export interface PricingResult<T> {
  ok: boolean;
  value?: T;
  diagnostics: PricingDiagnostic[];
}

export type ExpressionFunction = (...argumentsList: unknown[]) => unknown;

export interface ExpressionOptions {
  functions?: Readonly<Record<string, ExpressionFunction>>;
}

export type RenderMode = 'auto' | 'enabled' | 'disabled';

export type PriceSource =
  | { kind: 'fixed'; amount: number }
  | { kind: 'label'; text: string }
  | { kind: 'expression'; source: string; dependencies: string[] };

export interface PricingMetadata {
  syntaxVersion: string;
  saasName: string;
  version?: string;
  createdAt?: string;
  url?: string;
  tags: string[];
  currency: string;
}

export interface NormalizedBillingPeriod {
  id: string;
  label: string;
  multiplier: number;
}

export interface NormalizedFeature {
  id: string;
  name: string;
  description?: string;
  tag: string;
  type?: string;
  subtype?: string;
  valueType?: string;
  defaultValue?: unknown;
  expression?: string;
  serverExpression?: string;
  automationType?: string;
  docUrl?: string;
  integrationType?: string;
  pricingUrls: string[];
  render: RenderMode;
  raw: UnknownRecord;
}

export interface NormalizedUsageLimit {
  id: string;
  name: string;
  description?: string;
  tag: string;
  type?: string;
  period?: string;
  trackable?: boolean;
  valueType?: string;
  defaultValue?: unknown;
  unit?: string;
  linkedFeatures: string[];
  render: RenderMode;
  raw: UnknownRecord;
}

export interface NormalizedPlan {
  id: string;
  name: string;
  description?: string;
  private: boolean;
  price: PriceSource;
  unit?: string;
  features: Record<string, unknown>;
  usageLimits: Record<string, unknown>;
  raw: UnknownRecord;
}

export interface SubscriptionConstraints {
  minQuantity: number;
  maxQuantity?: number;
  quantityStep: number;
}

export interface NormalizedAddOn {
  id: string;
  name: string;
  description?: string;
  private: boolean;
  availableFor: string[];
  dependsOn: string[];
  excludes: string[];
  price: PriceSource;
  unit?: string;
  features: Record<string, unknown>;
  usageLimits: Record<string, unknown>;
  usageLimitsExtensions: Record<string, unknown>;
  subscriptionConstraints?: SubscriptionConstraints;
  raw: UnknownRecord;
}

export interface NormalizedPricing {
  metadata: PricingMetadata;
  billing: NormalizedBillingPeriod[];
  variables: Record<string, unknown>;
  features: NormalizedFeature[];
  usageLimits: NormalizedUsageLimit[];
  plans: NormalizedPlan[];
  addOns: NormalizedAddOn[];
  custom: UnknownRecord;
  raw: IPricingLike;
}

export interface PricingSyntaxAdapter {
  id: string;
  supports: (syntaxVersion: string) => boolean;
  adapt: (pricing: IPricingLike) => IPricingLike;
}

export interface NormalizePricingOptions {
  syntaxAdapters?: readonly PricingSyntaxAdapter[];
}

export interface AddOnSelection {
  selected: boolean;
  quantity: number;
}

export interface PricingSelection {
  planId?: string;
  billingPeriod?: string;
  variables: Record<string, unknown>;
  addOns: Record<string, AddOnSelection>;
}

export type ResolvedPrice =
  | {
      kind: 'amount';
      amount: number;
      baseAmount: number;
      billingMultiplier: number;
      quantity: number;
    }
  | { kind: 'label'; label: string; quantity: number }
  | { kind: 'error'; message: string; quantity: number };

export interface PriceBreakdownLine {
  kind: 'plan' | 'addOn';
  id: string;
  name: string;
  quantity: number;
  unitAmount?: number;
  billingMultiplier: number;
  amount?: number;
  requiresQuote: boolean;
  label?: string;
}

export interface PriceBreakdown {
  currency: string;
  billingPeriod?: NormalizedBillingPeriod;
  plan?: PriceBreakdownLine;
  addOns: PriceBreakdownLine[];
  subtotal: number;
  requiresQuote: boolean;
}

export interface ResolvedPricing {
  selection: PricingSelection;
  planPrices: Record<string, ResolvedPrice>;
  addOnPrices: Record<string, ResolvedPrice>;
  subtotal: number;
  requiresQuote: boolean;
  diagnostics: PricingDiagnostic[];
  breakdown: PriceBreakdown;
}

export interface ResolvePricingOptions {
  expression?: ExpressionOptions;
}

export type VariableControlType = 'boolean' | 'number' | 'text' | 'select' | 'slider';

export interface VariableControlOption {
  value: unknown;
  label: string;
}

export interface VariableControl {
  path: string;
  label?: string;
  description?: string;
  type: VariableControlType;
  min?: number;
  max?: number;
  step?: number;
  options?: VariableControlOption[];
  hidden?: boolean;
}

export interface PricingCta {
  id: string;
  label: string;
  href?: string;
  target?: '_self' | '_blank';
  planId?: string;
  kind?: 'primary' | 'secondary';
  metadata?: UnknownRecord;
}

export type PricingHighlightKind = 'feature' | 'usage-limit';
export type PricingHighlightMode = 'auto' | 'manual' | 'hybrid';

export interface PricingHighlightReference {
  id: string;
  kind?: PricingHighlightKind;
}

export interface PricingPlanInheritance {
  planId: string;
  label?: string;
}

export type PricingPlanInheritanceSetting = false | 'auto' | PricingPlanInheritance;

export interface PricingPlanHighlightConfiguration {
  mode?: PricingHighlightMode;
  items?: Array<string | PricingHighlightReference>;
  inheritsFrom?: PricingPlanInheritanceSetting;
  maxItems?: number;
}

export type PricingPlanHighlightSetting =
  PricingPlanHighlightConfiguration | Array<string | PricingHighlightReference>;

export type PricingBadgeTone = 'accent' | 'success' | 'warning' | 'neutral';

export interface PricingPlanBadge {
  id: string;
  label: string;
  tone?: PricingBadgeTone;
  emphasize?: boolean;
}

export interface PricingUnitLabel {
  one: string;
  other: string;
}

export type PricingUnitLabels = Record<string, Record<string, PricingUnitLabel>>;

export interface PricingPresentation {
  title?: string;
  subtitle?: string;
  planBadges?: Record<string, PricingPlanBadge[]>;
  planHighlights?: Record<string, PricingPlanHighlightSetting>;
  planInheritance?: false | 'auto';
  ctas?: PricingCta[];
  variableControls?: 'auto' | false | VariableControl[];
  billingLabels?: Record<string, string>;
  unitLabels?: PricingUnitLabels;
  maxHighlights?: number;
}

export type PricingMode = 'commercial' | 'catalog';
export type PricingLayout = 'auto' | 'compact' | 'table';
export type PricingVisibility = 'public-only' | 'all';

export type MessageCatalog = Record<string, string>;

export interface PricingRendererConfig {
  locale: string;
  pricingPath: string;
  selectionEnabled: boolean;
  ctaEnabled: boolean;
  variablesEnabled: boolean;
  presentation: PricingPresentation;
}

export interface ViewModelOptions {
  locale?: string;
  messages?: MessageCatalog;
  mode?: PricingMode;
  visibility?: PricingVisibility;
  presentation?: PricingPresentation;
  expression?: ExpressionOptions;
}

export interface PricingValueCell {
  planId: string;
  value: unknown;
}

export interface PricingComparisonRow {
  id: string;
  kind: PricingHighlightKind;
  name: string;
  description?: string;
  category: string;
  unit?: string;
  docUrl?: string;
  values: PricingValueCell[];
  raw: UnknownRecord;
}

export interface PricingPlanHighlightSummary {
  rows: PricingComparisonRow[];
  badges: PricingPlanBadge[];
  inheritedFrom?: {
    planId: string;
    planName: string;
    label: string;
  };
}

export interface PricingComparisonGroup {
  id: string;
  name: string;
  /**
   * What the group holds. Absent means `'tag'`. An `'untagged'` group is the only group of a pricing
   * that declares no tag, and it renders without a header.
   */
  kind?: 'tag' | 'other-features' | 'untagged';
  rows: PricingComparisonRow[];
}

export interface PricingViewModel {
  pricing: NormalizedPricing;
  resolved: ResolvedPricing;
  plans: NormalizedPlan[];
  addOns: NormalizedAddOn[];
  comparisonGroups: PricingComparisonGroup[];
  variableControls: VariableControl[];
  presentation: PricingPresentation;
  locale: string;
  messages: MessageCatalog;
  mode: PricingMode;
  visibility: PricingVisibility;
}

export interface ExpressionEvaluation {
  value?: number;
  error?: string;
}

export type JsonValue =
  null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

export interface SelectionComparisonSide {
  pricing: NormalizedPricing;
  selection: Partial<PricingSelection>;
}

export interface SelectionComparisonInput {
  /** The contract, on its pricing version. */
  before: SelectionComparisonSide;
  /** The edit, on the same or a newer pricing version. */
  after: SelectionComparisonSide;
  /** Usage-limit id to consumed amount (SPACE usageLevels). */
  currentUsage?: Readonly<Record<string, number>>;
  /** Passed to `resolvePricing` on both sides. */
  expression?: ExpressionOptions;
}

export type SelectionRelation = 'current' | 'upgrade' | 'downgrade' | 'change';
export type ItemPresence = 'both' | 'before-only' | 'after-only';

export type ComparedValue =
  | { kind: 'none' }
  | { kind: 'unlimited' }
  | { kind: 'boolean'; value: boolean }
  | { kind: 'number'; value: number }
  | { kind: 'text'; value: string }
  | { kind: 'json'; value: JsonValue };

export interface ComparedPlan {
  /** Absent when the side's merged selection has no plan id. */
  id?: string;
  /** Present only when the id is a plan id of that side's pricing. */
  name?: string;
  known: boolean;
}

export interface PlanComparison {
  before: ComparedPlan;
  after: ComparedPlan;
  changed: boolean;
}

export interface CatalogIds {
  plans: string[];
  addOns: string[];
  features: string[];
  usageLimits: string[];
}

export interface VersionComparison {
  before?: string;
  after?: string;
  changed: boolean;
  onlyInBefore: CatalogIds;
  onlyInAfter: CatalogIds;
}

export interface AddOnChange {
  id: string;
  name: string;
  quantity: number;
  presence: ItemPresence;
}
export type AddOnRemovalReason = 'unavailable-for-plan' | 'dependency-removed' | 'not-in-version';
export interface AddOnRemoval extends AddOnChange {
  reason: AddOnRemovalReason;
}
export interface AddOnQuantityChange {
  id: string;
  name: string;
  before: number;
  after: number;
  delta: number;
}

export interface AddOnComparison {
  added: AddOnChange[];
  removedByUser: AddOnChange[];
  removedByReconciliation: AddOnRemoval[];
  quantityChanged: AddOnQuantityChange[];
  unchanged: string[];
}

export interface FeatureChange {
  id: string;
  name: string;
  before: ComparedValue;
  after: ComparedValue;
  presence: ItemPresence;
}
export interface FeatureComparison {
  gained: FeatureChange[];
  lost: FeatureChange[];
  changed: FeatureChange[];
  unchanged: string[];
}

export interface UsageLimitChange {
  id: string;
  name: string;
  unit?: string;
  before: ComparedValue;
  after: ComparedValue;
  /** `after - before`, only when both values are numbers. */
  delta?: number;
  direction: 'increased' | 'decreased' | 'changed';
  presence: ItemPresence;
  /** The valid `currentUsage` entry for this id. */
  currentUsage?: number;
  /** Present only when the consumed amount is above the new limit. */
  exceedsCurrentUsage?: true;
}
export interface UsageLimitComparison {
  changed: UsageLimitChange[];
  unchanged: string[];
  /** Ids flagged by the current usage, changed or not. */
  exceeded: string[];
}

export interface PriceComparison {
  before: PriceBreakdown;
  after: PriceBreakdown;
  billingPeriodChanged: boolean;
  difference?: number;
  differenceOmitted?: 'quote' | 'currency';
}

export interface SelectionComparison {
  relation: SelectionRelation;
  version: VersionComparison;
  plan: PlanComparison;
  addOns: AddOnComparison;
  features: FeatureComparison;
  usageLimits: UsageLimitComparison;
  price: PriceComparison;
  selections: { before: PricingSelection; after: PricingSelection };
  diagnostics: PricingDiagnostic[];
}
