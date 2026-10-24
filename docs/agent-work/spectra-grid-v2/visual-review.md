# Visual review of pricing renderer baselines

All five images were opened and viewed. They are viewport crops of a longer page, not full-page captures. No earlier versions are available (no git history to compare), so this review describes the current images only and says nothing about changes.

## desktop-1024-linux.png

- Plan cards: 3 (Starter, Growth, Enterprise), in one row of 3 columns. No lone last card.
- First plan button: visible ("Start with Starter"), as are the other two buttons.
- Hero title: not visible, the crop starts inside the cards.
- Spacing above the plans: not visible, the card tops touch the top edge of the image and their top borders are cut by the crop.
- Spacing below: about 60 px to the "Pricing details / Compare plans" heading.
- Defects: none in the layout. Minor observations: the Starter button label is lighter in weight than the other two and its button starts a few pixels higher, because the Starter card has empty space above it. Card heights are equal. No overflow, no overlapping or cut-off text, contrast is readable.

## desktop-1200-linux.png

- Plan cards: 3, in one row of 3 columns. No lone last card.
- First plan button: visible ("Start with Starter").
- Hero title: not visible.
- Spacing above the plans: not visible, the card tops are cut by the crop.
- Defects: none. Same minor observation as at 1024 (lighter Starter button label, button a few pixels higher). Card heights are equal, descriptions fit on one line, no overflow, contrast is readable.

## desktop-1440-linux.png

- Plan cards: 3, in one row of 3 columns. No lone last card.
- First plan button: visible ("Start with Starter").
- Hero title: not visible. The crop shows only the "Plans" section heading (about 28 px text), with the bottom edge of an element above it.
- Spacing above the plans: about 15 px between the "Plans" heading and the card tops, and about 35 px from the element above to the "PLANS" label. The top of the cards is fully visible here.
- Defects: none in the layout. Same minor observation as above (lighter Starter button label, button a few pixels higher). Card heights are equal, no overflow, no cut-off or overlapping text, contrast is readable.

## table-840-linux.png

- Plan cards: 3, in two columns. Row 1 has Starter and Growth, row 2 has Enterprise alone at the left (a lone last card, with an empty right half).
- First plan button: visible ("Start with Starter"), but only the bottom of the first row is shown, so the card tops are cropped.
- Hero title: not visible.
- Spacing above the plans: not visible. Gap between the rows is about 15 px.
- Defects: the lone Enterprise card leaves a large empty area on the right. The comparison table below has switched to a stacked, card-per-feature layout. No overflow, no overlapping or cut-off text, contrast is readable.

## tablet-839-linux.png

- Plan cards: 3, in two columns. Row 1 has Starter and Growth, row 2 has Enterprise alone at the left (lone last card, empty right half).
- First plan button: visible ("Start with Starter"), with the first row's tops cropped as in the 840 image.
- Hero title: not visible.
- Spacing above the plans: not visible. Gap between the rows is about 15 px.
- Defects: same lone-card gap as the 840 image. The image is 839 px wide and looks identical to the 840 one apart from a 1 px shift. No overflow, no overlapping or cut-off text, contrast is readable.

## Verdict

defects found: lone last card in the 2-column layout at 840 and 839 px (Enterprise alone on the left with an empty right half). Minor: the Starter button label is lighter in weight and its button starts slightly higher than the other buttons at desktop widths. The hero title and the spacing above the plans cannot be judged from these crops.
