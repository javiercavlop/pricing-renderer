import { LitElement, html, nothing, type TemplateResult } from 'lit';
import {
  cloneValue,
  getMessages,
  translate,
  type MessageCatalog,
  type SelectionComparison,
} from '../core/index.js';
import type {
  PricingChangeBackDetail,
  PricingChangeConfirmDetail,
} from './change-review-events.js';

// The review of a subscription change. This is the data contract: the properties, the events, the
// Confirm default action, the guards and the base parts. The sections of the review (plan, price,
// add-ons, features, usage limits) come with the review UI.
export class PricingChangeReviewElement extends LitElement {
  // [impl->req~review-properties~1]
  static properties = {
    comparison: { attribute: false },
    notices: { attribute: false },
    pending: { type: Boolean, reflect: true },
    error: { type: String },
    locale: { type: String },
    messages: { attribute: false },
    confirmLabel: { type: String, attribute: 'confirm-label' },
  };

  declare comparison?: SelectionComparison;
  declare notices: string[];
  declare pending: boolean;
  declare error?: string;
  declare locale: string;
  declare messages?: MessageCatalog;
  declare confirmLabel?: string;

  constructor() {
    super();
    this.notices = [];
    this.pending = false;
    this.locale = 'en-US';
  }

  // [impl->req~review-light-dom~1]
  protected createRenderRoot(): HTMLElement | DocumentFragment {
    return this;
  }

  // [impl->req~review-confirm-event~1] [impl->req~review-confirm-pending~1]
  // [impl->req~review-confirm-blocked~1]
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

  // [impl->req~review-back-event~1] No default action and no guard: Back never changes `pending`.
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

  // [impl->req~review-base-parts~1]
  protected render(): unknown {
    const comparison = this.comparison;
    if (!comparison) return nothing;
    // a removed locale attribute makes the property null
    const locale = typeof this.locale === 'string' && this.locale !== '' ? this.locale : 'en-US';
    const messages = getMessages(locale, this.messages);
    const notices = Array.isArray(this.notices) ? this.notices : [];
    const error = typeof this.error === 'string' && this.error !== '' ? this.error : undefined;
    const label = typeof this.confirmLabel === 'string' ? this.confirmLabel : '';
    const blocked = this.pending || comparison.relation === 'current';
    return [
      this._renderNotices(notices),
      this._renderError(error),
      this._renderBack(translate(messages, 'pricing.reviewBack')),
      this._renderConfirm(label || translate(messages, 'pricing.reviewConfirm'), blocked),
    ];
  }

  // [impl->req~review-text-only~1] Notices and the error are bound as text (Lit text bindings),
  // never as HTML.
  private _renderNotices(notices: string[]): TemplateResult | typeof nothing {
    if (notices.length === 0) return nothing;
    const items = notices.map((notice) => html`<li>${notice}</li>`);
    return html`<ul data-pr-part="review-notices">
      ${items}
    </ul>`;
  }

  private _renderError(error: string | undefined): TemplateResult | typeof nothing {
    if (error === undefined) return nothing;
    return html`<div data-pr-part="review-error">${error}</div>`;
  }

  private _renderBack(label: string): TemplateResult {
    return html`<button
      class="pr-button pr-button--secondary"
      data-pr-part="review-back"
      type="button"
      @click=${this._back}
    >
      ${label}
    </button>`;
  }

  // `aria-disabled` and not `disabled`, so that focus stays on the button.
  private _renderConfirm(label: string, blocked: boolean): TemplateResult {
    return html`<button
      class="pr-button pr-button--primary"
      data-pr-part="review-confirm"
      aria-disabled=${blocked ? 'true' : nothing}
      type="button"
      @click=${this._confirm}
    >
      ${label}
    </button>`;
  }
}
