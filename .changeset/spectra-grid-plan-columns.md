---
'pricing-renderer': patch
---

Plan cards now fill the width in fluid columns chosen by the number of plans and the renderer width (at most 3 columns from 840px and at most 4 from 1040px, without a single card left alone in the last row where it can be avoided), and from 840px the hero title is smaller (3rem at most) and the plan cards and the space above them are tighter, so the first plan button fits in the first screen at 1440px. Words such as "Unlimited" are no longer split inside the word in narrow cells, while very long strings still wrap in cards (in the comparison table they widen their column inside the scroll box). Visual change by default, approved by the owner (crp-spectra-phase2-improvements); no new attribute or API.
