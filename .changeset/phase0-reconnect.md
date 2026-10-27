---
'pricing-renderer': patch
---

Resume a pricing load when the element is moved to another parent while it is still loading: the element observes its size again, measures its width and reloads, instead of staying on the loading skeleton. A ready element does not reload when it is moved.
