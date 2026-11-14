# Overview redesign plan

**Goal:** Redesign only the academy overview, preserving section order, data, permissions, and all front-desk actions.

**Direction:** A focused reception desk: composed, practical, athletic. Keep the academy identity and Google Sans. Use graphite surfaces, restrained gold, and a strong search field. Attendance is the working area; the membership chart is the only multicolour data moment. The signature is a narrow gold rule at the check-in heading.

**Audit:** Repeated uppercase captions compete with headings; too many filled icon tiles; spacious equal stat cards delay useful data; shortcut cards repeat the main action; explanatory copy is repetitive; the check-in panel has excess empty space.

1. Capture the current overview using intercepted, synthetic preview records. Save the original DOM and CSS for the process video.
2. Apply spacing, colour, icons, copy, type, layout, details, visuals, and motion passes. Scope styles under `.overview-page`; keep shared navigation and other routes unchanged.
3. Validate desktop, tablet, mobile, keyboard focus, locked payment values, member search, history expansion, and navigation. Run TypeScript and existing tests.
4. Produce an attributed Unslop story with progressive CSS changes; render MP4 and inspect extracted frames.

No database or authentication changes. Preview records are fixtures, never written to the live service. No generated imagery is needed for a working reception dashboard.
