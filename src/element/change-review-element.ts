import { LitElement, nothing, type PropertyValues } from 'lit';
import {
  cloneValue,
  deepEqual,
  getMessages,
  type MessageCatalog,
  type SelectionComparison,
} from '../core/index.js';
import type {
  PricingChangeBackDetail,
  PricingChangeConfirmDetail,
} from './change-review-events.js';
import {
  REVIEW_SECTION_NAMES,
  renderChangeReview,
  type ReviewSectionName,
} from './change-review-renderers.js';
import { hiddenNamesOf, sectionsConverter } from './hide-sections.js';

// One per element, so that the ids of the headings stay unique when a page has several reviews.
let instances = 0;

// Whitespace separated; only tokens that exactly match a part name are kept, in order.
export const reviewHideSectionsConverter = sectionsConverter(REVIEW_SECTION_NAMES);

// The review of a subscription change: the properties, the events, the Confirm default action and
// the guards, and the review UI rendered by change-review-renderers.ts.
export class PricingChangeReviewElement extends LitElement {
  static properties = {
    comparison: { attribute: false },
    notices: { attribute: false },
    pending: { type: Boolean, reflect: true },
    error: { type: String },
    locale: { type: String },
    messages: { attribute: false },
    confirmLabel: { type: String, attribute: 'confirm-label' },
    // a host that builds the array in its render function does
    // not re-render on every render
    hideSections: {
      attribute: 'hide-sections',
      converter: reviewHideSectionsConverter,
      hasChanged: (value: unknown, previous: unknown) => !deepEqual(value, previous),
    },
  };

  declare comparison?: SelectionComparison;
  declare notices: string[];
  declare pending: boolean;
  declare error?: string;
  declare locale: string;
  declare messages?: MessageCatalog;
  declare confirmLabel?: string;
  declare hideSections?: readonly ReviewSectionName[];

  private readonly _idPrefix = `pr-review-${++instances}`;

  constructor() {
    super();
    this.notices = [];
    this.pending = false;
    this.locale = 'en-US';
  }

  protected createRenderRoot(): HTMLElement | DocumentFragment {
    return this;
  }

  // A canceled event leaves `pending` to the host. Otherwise `pending` is set before this returns,
  // so a second activation is ignored before the host reacts.
  private _confirm = (): void => {
    const comparison = this.comparison;
    if (!comparison || this.pending || comparison.relation === 'current') return;
    const event = new CustomEvent<PricingChangeConfirmDetail>('pricing-change-confirm', {
      detail: { comparison: cloneValue(comparison) },
      bubbles: true,
      composed: true,
      cancelable: true,
    });
    if (this.dispatchEvent(event)) this.pending = true;
  };

  // No default action and no guard: Back never changes `pending`.
  private _back = (): void => {
    const comparison = this.comparison;
    if (!comparison) return;
    this.dispatchEvent(
      new CustomEvent<PricingChangeBackDetail>('pricing-change-back', {
        detail: { comparison: cloneValue(comparison) },
        bubbles: true,
        composed: true,
        cancelable: true,
      }),
    );
  };

  // A new comparison moves focus to the heading, so a screen reader starts at the review. A new
  // error moves it to Confirm, which `pending = false` has enabled again, so the user can retry.
  // The comparison wins when both change in one update.
  protected updated(changed: PropertyValues): void {
    if (!this.comparison) return;
    if (changed.has('comparison')) {
      this.querySelector<HTMLElement>('[data-pr-part="review-title"]')?.focus();
    } else if (changed.has('error') && this._errorText() !== undefined) {
      this.querySelector<HTMLElement>('[data-pr-part="review-confirm"]')?.focus();
    }
  }

  private _errorText(): string | undefined {
    return typeof this.error === 'string' && this.error !== '' ? this.error : undefined;
  }

  protected render(): unknown {
    const comparison = this.comparison;
    if (!comparison) return nothing;
    // a removed locale attribute makes the property null
    const locale = typeof this.locale === 'string' && this.locale !== '' ? this.locale : 'en-US';
    const hidden = hiddenNamesOf(REVIEW_SECTION_NAMES, this.hideSections);
    return renderChangeReview({
      comparison,
      locale,
      messages: getMessages(locale, this.messages),
      notices: Array.isArray(this.notices) ? this.notices : [],
      error: this._errorText(),
      pending: this.pending,
      blocked: this.pending || comparison.relation === 'current',
      confirmLabel: typeof this.confirmLabel === 'string' ? this.confirmLabel : undefined,
      idPrefix: this._idPrefix,
      onConfirm: this._confirm,
      onBack: this._back,
      ...(hidden.size > 0 ? { hiddenSections: hidden } : {}),
    });
  }
}
