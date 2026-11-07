---
'pricing-renderer': minor
---

The running total no longer sits inside the add-on layout. A sticky element is pinned only while its own containing block is on screen, and that layout is one section near the end of the page, so a pricing with add-ons got a bottom bar that existed only after the reader had scrolled past the comparison and the add-on grid — furthest away exactly when add-ons are what move the total. It now closes the content, where its containing block is everything after the plans, and at 840px or more with a plan selected it docks above the comparison instead. The add-on grid drops the 288px sidebar column it used to reserve.
