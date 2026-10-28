## ADDED Requirements

### Requirement: Featured state attribute

`req~state-featured~1`
The element SHALL render every plan card `[data-pr-part='plan-card']` with `data-featured="true"` when the plan has a badge with `emphasize: true`, the same condition as the class `is-featured`, and with `data-featured="false"` otherwise.

Needs: impl, utest

#### Scenario: One emphasized badge

- **GIVEN** the Acme pricing (`tests/fixtures/acme-pricing.yml`) with `presentation.planBadges` `{ growth: [{ id: 'popular', label: 'Most popular', emphasize: true }], starter: [{ id: 'new', label: 'New' }] }`
- **WHEN** the plans are rendered
- **THEN** the Growth card has `data-featured="true"` and the class `is-featured`
- **AND** the Starter and Enterprise cards have `data-featured="false"` and no class `is-featured`

#### Scenario: No badges

- **GIVEN** the Acme pricing without `presentation.planBadges`
- **WHEN** the plans are rendered
- **THEN** each of the three plan cards has `data-featured="false"`

### Requirement: Availability state attribute

`req~state-available~1`
The element SHALL render every add-on card `[data-pr-part='add-on-card']` with `data-available="false"` when it has the class `is-unavailable` and with `data-available="true"` otherwise, and render no `data-available` attribute on plan cards.

Needs: impl, utest

#### Scenario: Add-on not offered for the selected plan

- **GIVEN** the Acme pricing with the selection `{ planId: 'starter' }`
- **WHEN** the add-ons are rendered
- **THEN** the `extraStorage` card has `data-available="false"` and the class `is-unavailable`
- **AND** no plan card has a `data-available` attribute

#### Scenario: Add-on offered for the selected plan

- **GIVEN** the Acme pricing with the selection `{ planId: 'growth' }`
- **WHEN** the add-ons are rendered
- **THEN** the `extraStorage` card has `data-available="true"` and no class `is-unavailable`

### Requirement: CTA kind attribute

`req~state-kind~1`
The element SHALL render every plan CTA `[data-pr-part='cta']`, in its link and its button form, with `data-kind` set to the `kind` of its configured CTA, `primary` when the CTA has no `kind`.

Needs: impl, utest

#### Scenario: Link and button forms

- **GIVEN** the Acme pricing with `presentation.ctas` `[{ id: 'start-starter', label: 'Start', planId: 'starter' }, { id: 'start-growth', label: 'Trial', planId: 'growth', kind: 'secondary', href: 'https://example.com/signup' }, { id: 'contact-enterprise', label: 'Contact', planId: 'enterprise', kind: 'primary', href: 'https://example.com/contact' }]`
- **WHEN** the plans are rendered
- **THEN** the Starter CTA is a `button` with `data-kind="primary"`
- **AND** the Growth CTA is an `a` with `data-kind="secondary"` and the Enterprise CTA is an `a` with `data-kind="primary"`

#### Scenario: Current plan button

- **GIVEN** the same pricing and CTAs with `currentSelection` `{ planId: 'growth' }`
- **WHEN** the plans are rendered
- **THEN** the Growth CTA is a disabled `button` with `data-kind="secondary"`

### Requirement: Current and selected hooks stay stable

`req~state-current~1`
WHILE `currentSelection.planId` is a plan id of the loaded pricing, the element SHALL keep rendering `data-current="true"` on the current plan card and on each current add-on card, with no `data-current` attribute on the other cards, and `data-selected="true"` or `data-selected="false"` on every plan and add-on card.

Needs: impl, utest

#### Scenario: Contract on Acme

- **GIVEN** the Acme pricing with `currentSelection` `{ planId: 'growth', addOns: { extraStorage: { selected: true, quantity: 2 }, prioritySuccess: { selected: true, quantity: 1 } } }` and the selection `{ planId: 'starter' }`
- **WHEN** the plans and add-ons are rendered
- **THEN** the Growth card has `data-current="true"` and `data-selected="false"`, the Starter card has `data-selected="true"` and no `data-current`, and the Enterprise card has neither `data-current` nor `data-selected="true"`
- **AND** the `extraStorage` and `prioritySuccess` cards have `data-current="true"` and the `compliance` card has no `data-current`

#### Scenario: No current selection

- **GIVEN** the Acme pricing without `currentSelection`
- **WHEN** the plans and add-ons are rendered
- **THEN** no element has a `data-current` attribute
