# AgriValue UI Design

## Visual direction

Build a mobile-first interface for Karnataka ragi farmers. The main task is to record a harvest and decide where to sell now, whether to wait, and what to do with the straw. Put the recommended action, estimated net return, and any decision-changing warning at the top. Let the farmer expand the calculation to see the price, deductions, and assumptions.

## Modern Precision-Ag palette

| Role | Color | Hex | Apply to |
|---|---|---|---|
| Primary | Deep Forest Green | `#1B4332` | App header, navigation, links and selected labels |
| Secondary | Sage / Leaf Green | `#40916C` | Active-tab indicators, toggle fills and positive status icons |
| Background | Warm Alabaster | `#F4F1EA` | Page canvas |
| Surface | Crisp Off-White | `#FFFFFF` | Cards, dialogs and fields |
| Accent | Harvest Amber | `#D97706` | Main CTA fill, key metric markers and alerts |
| Text | Rich Charcoal | `#1F2937` | Body copy, input values and financial figures |

- Use white text on forest green and charcoal text on white or alabaster. Use charcoal text on amber and outline the button in forest green when it sits on alabaster. Use sage for indicators and pair it with a charcoal label on a light surface. Keep key figures charcoal and use amber as a marker beside them.
- Use DM Sans for English and Noto Sans Kannada for Kannada. Start with 16 px body text, 14 px secondary labels, 24 px page titles and 28–32 px for the main return figure. Use tabular digits for aligned prices and amounts where supported.
- Use 16 px mobile gutters, 16 px card padding and 12 px corner radii. Stack cards on phones. From 768 px, allow two columns for independent panels such as crop and residue. Use a compact desktop sidebar and keep the main content readable at a maximum width of about 1120 px.
- Give interactive controls at least 48 × 48 px touch targets and visible keyboard focus. Pair every status color with a label or icon. Use explicit field labels, inline error text and a clear heading hierarchy.

## Public homepage

Follow the reference’s section order. Use a photographic hero, a centered feature grid, a forest-green band, a split product preview and a compact closing call to action.

| Section | Layout and AgriValue content |
|---|---|
| Header | Place a leaf mark and **AgriValue** wordmark at left, **Home**, **Features** and **How it works** in the middle, and an amber **Get started** button at right. Features and How it works scroll to their sections. Get started opens mobile OTP sign-in. |
| Hero | Use a wide farm photograph with a farmer on the right looking at a tablet in a Karnataka ragi field. Keep the left side quiet for copy with an alabaster-to-transparent overlay. Set the headline on two lines, **Sell your harvest smarter.** in charcoal and **Make more of your straw.** in forest green. Below, say “Compare nearby markets, decide when to sell, and find buyers for your ragi straw.” Use an amber **Get started** button and a white **Explore features** button. |
| Hero preview | Float a compact forest-green **Sample recommendation** card at the lower right of the photo. Show **Sell now at Market B**, **₹74,570 estimated net return** and **Straw buyer available**. Use an opaque enough surface to keep text legible. |
| Feature grid | Center **Plan what happens after harvest** over four white cards with forest-green line icons on alabaster circles. The cards are **Market prices**, **Sell or store**, **Straw buyers** and **Combined plan**. Use one sentence per card that explains the action it supports. |
| Value band | Use a rounded forest-green band with four evenly spaced icon-and-label items: **Nearby prices**, **Costs accounted for**, **Verified buyers** and **One combined plan**. Use white labels and sage icon accents. |
| Product preview | Place **See what you could take home** and a short three-step walkthrough on the left. On the right, overlap a phone preview of the farmer’s recommendation with a larger desktop preview of the crop comparison. Show the same sample harvest in both views, with the sample label visible. |
| Closing CTA | Use an alabaster strip with a leaf mark, **Plan your next ragi sale**, and an amber **Get started** button. Keep the language switch accessible from the header and sign-in. |

Use **DM Serif Text** for English marketing headlines and keep DM Sans for navigation, body text and app screens. Use Noto Sans Kannada for Kannada headlines and body text. Start with a 50–56 px desktop hero heading and 32–36 px on mobile. Keep the feature cards low-shadow and use thin borders. Let the hero image and typography carry the page visually.

At 1024 px and wider, use a four-column feature grid and side-by-side product preview. At tablet sizes, switch the feature grid and value band to two columns. Below 600 px, place the hero copy above the image, move the sample card below the photo, and stack feature cards and product previews. Use a labeled menu for the public section links and keep **Get started** visible in the header. Check that the farmer stays in frame at each crop and that text remains readable without the image.

## Signed-in farmer navigation

Use four labeled destinations on mobile: **Home**, **Harvests**, **Markets**, and **Profile**. Open recommendations from their harvest. Put saved decisions and actual sale outcomes under each harvest. Give Kannada and English equal prominence on sign-in and keep the language switch in Profile.

| Screen | Content and actions |
|---|---|
| Sign in | Mobile number, language choice, OTP entry, resend timer and an option to edit the number. Keep entered values when retrying. |
| Home | Latest harvest, its recommendation status and one next action. Use **Add harvest** for a new account and **View plan** for an existing recommendation. |
| Farm and harvest | Collect farm location, storage and vehicle capacity, then crop, variety, grade, quantity and date. Show the chosen unit beside quantity and the converted quintals before submission. Group latest sale date, cash amount and cash deadline together. |
| Markets | Show nearby market name, distance, modal price in ₹/qtl, date and freshness. Open market detail for 12 months of price history and available forecast ranges. Clearly distinguish observed prices from forecast values. |
| Crop comparison | Show the selected action, market, sale timing and estimated net return. List sell-now, storage and applicable partial-sale options with amount sold now, estimated cash by the deadline and any exclusion reason. Expand an option to see revenue and transport, market, storage and waiting costs. |
| Residue | Capture straw type, moisture and quantity kept. Show generated, recoverable and available quantities. List suitable uses and verified buyer matches with distance, minimum lot, pickup or delivery terms and estimated net return. Always show **Keep for own use** and its estimated value. |
| Combined plan | Show crop and straw actions together, estimated total return, and cash expected by the deadline. Summarize storage and transport requirements. Show the two independent choices as a comparison and name any shared constraint they exceed. |
| History and outcomes | List saved runs by date and show the assumptions from that run. Let farmers record their actual sale date, quantity, price and costs for comparison with the estimate. |

## Recommendation card

Use the same order for crop, residue and combined recommendations.

1. Display the action and destination, such as **Sell now at Market B**.
2. Show **Estimated net return** with the rupee amount, followed by sale timing and the reason for the recommendation.
3. Show warnings that affect the decision directly on the card. Include the price date and a link labeled **See calculation**.
4. List other options below, with their return, timing and a short reason when they are unavailable or risky.

On mobile, show options as stacked cards with the same field order. On desktop, use a table for market, timing, net return and status. Format INR consistently, for example `₹74,570`. Display forecasts as a low–high band around the expected value and provide the same values as text.

## States and feedback

| State | Display |
|---|---|
| Loading | Keep the page title and entered inputs visible. Show a labeled progress state while recommendations run. |
| Current price | Show the price date. The current window is 0–7 days. |
| Older price | Show **Older price** and its date for observations aged 8–30 days. Explain that the estimate uses that price. |
| Expired price | For observations over 30 days old, show **Excluded — price over 30 days old** with the date. |
| Forecast missing | Show **Storage not evaluated — insufficient price data** where applicable and keep eligible sell-now results visible. |
| Storage below threshold | Show **Possible but risky** and explain whether the estimated improvement or chance of beating sell-now fell short. |
| No match or feasible plan | Explain the failed condition. Keep the residue own-use option visible and link back to the relevant input when the farmer can change it. |
| Error | Explain what failed, keep the form values, and offer **Try again** or focus the first invalid field. |
| Demo records | Label sample prices and buyers directly where they appear. |
| Contact sharing | Show a confirmation dialog with the buyer, the information being shared and who will receive it. Reveal contact only after confirmation. |

## Staff and partner screens

Use the same palette and form components. Show actions according to the signed-in role.

| Role | Screens |
|---|---|
| Admin | Price import with accepted and rejected row counts, market and crop settings, dated cost defaults, stale-price flags, buyer verification, role management and recommendation audit history. |
| Buyer | Facility profile, demand and pickup terms, and matched supply with farmer identity hidden before consent. |
| Logistics provider | Vehicle capacity and rates, plus collection opportunities grouped by village and date. |
| Advisor | Consent-scoped farmer access, assisted entry with attribution, and a what-if form with the saved recommendation available for comparison. |
| FPO manager | Member linking, aggregate quantities and bulk comparison if project decision D7 is approved. |

## Build order and review

1. Build the shared layout, typography, buttons, forms, cards and status messages. Assemble the public homepage with the hero, feature grid, value band, previews and sign-in links.
2. Connect sign-in, profile, farm and harvest entry, then market browsing.
3. Add crop comparison, residue matching and the combined plan. Connect the screens to the saved recommendation and outcome flows.
4. Add admin, buyer, advisor and logistics screens. Implement the FPO screens after approval in the project scope.
5. Walk through the farmer flow at 360 px in both languages. Check long Kannada labels, keyboard navigation, visible focus, touch targets, date and price wrapping, stale market data, missing forecasts and contact confirmation.

Source material includes the AgriValue Synopsis, Functional Specification Document, Solution Design Document, User Stories the supplied Modern Precision-Ag palette and the attached AgriConnect screenshot as a layout reference.
