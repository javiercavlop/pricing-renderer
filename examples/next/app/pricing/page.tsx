import { PricingClient } from '../pricing-client';

const pricingYaml = String.raw`
syntaxVersion: '3.1'
saasName: Example Cloud
currency: EUR
billing:
  monthly: 1
  yearly: 0.8
variables:
  seats: 5
features:
  projects:
    description: Active projects in the workspace.
    tag: Workspace
    valueType: BOOLEAN
plans:
  starter:
    description: For teams finding product-market fit.
    price: '4 * #seats'
    unit: month
    features:
      projects:
        value: true
  growth:
    description: For teams scaling reliable operations.
    price: '9 * #seats'
    unit: month
    features:
      projects:
        value: true
addOns:
  extraStorage:
    description: Additional managed storage packs.
    availableFor: [growth]
    price: 5
    unit: pack/month
    subscriptionConstraints:
      minQuantity: 1
      maxQuantity: 10
      quantityStep: 1
custom:
  pricingRenderer:
    title: Pricing that grows with your team
    subtitle: This YAML string crosses a Server → Client Component boundary.
    planBadges:
      growth:
        - id: most-popular
          label: Most popular
          tone: accent
          emphasize: true
    variableControls:
      - path: seats
        type: slider
        label: Team seats
        min: 1
        max: 100
        step: 1
    billingLabels:
      monthly: Monthly
      yearly: Yearly
    ctas:
      - id: start-starter
        label: Start with Starter
        planId: starter
      - id: start-growth
        label: Start free trial
        planId: growth
`;

export default function PricingPage() {
  return (
    <main>
      <header>
        <p>Next App Router example</p>
        <h1>Client-island pricing, server-owned source.</h1>
        <span>
          The page stays a Server Component. Only the interactive renderer crosses the client
          boundary.
        </span>
      </header>
      <PricingClient yaml={pricingYaml} />
    </main>
  );
}
