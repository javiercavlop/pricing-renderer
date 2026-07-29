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

export interface ResolvedPricing {
  selection: PricingSelection;
  planPrices: Record<string, ResolvedPrice>;
  addOnPrices: Record<string, ResolvedPrice>;
  subtotal: number;
  requiresQuote: boolean;
  diagnostics: PricingDiagnostic[];
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

export interface PricingPresentation {
  title?: string;
  subtitle?: string;
  recommendedPlanId?: string;
  highlightedFeatureIds?: Record<string, string[]>;
  ctas?: PricingCta[];
  variableControls?: 'auto' | false | VariableControl[];
  billingLabels?: Record<string, string>;
  maxHighlights?: number;
}

export type PricingMode = 'commercial' | 'catalog';
export type PricingLayout = 'auto' | 'compact' | 'table';
export type PricingVisibility = 'public-only' | 'all';

export type MessageCatalog = Record<string, string>;

export interface ViewModelOptions {
  locale?: string;
  messages?: MessageCatalog;
  mode?: PricingMode;
  visibility?: PricingVisibility;
  presentation?: PricingPresentation;
}

export interface PricingValueCell {
  planId: string;
  value: unknown;
}

export interface PricingComparisonRow {
  id: string;
  kind: 'feature' | 'usage-limit';
  name: string;
  description?: string;
  category: string;
  unit?: string;
  docUrl?: string;
  values: PricingValueCell[];
  raw: UnknownRecord;
}

export interface PricingComparisonGroup {
  id: string;
  name: string;
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
