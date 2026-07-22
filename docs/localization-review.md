# Localization review

Halovia's interface supports English, Hindi, Spanish, French, Russian, Urdu, Bengali, Tamil, and Arabic. English remains the source language and default. Arabic and Urdu use right-to-left layout.

The revised landing page, map and destination states, location-permission messages, shared-journey availability, and update-age messages have localized catalogue entries in every supported language. Spanish, French, and Russian were added without changing stored user content such as names and addresses.

Before a public safety-service launch, a fluent human reviewer should review every non-English catalogue in context, with particular attention to:

- emergency and help wording;
- the distinction between a visible journey update and an automatically sent message;
- location-permission and background-update limitations;
- regional emergency terminology;
- plural forms for seconds and minutes;
- long labels, mobile wrapping, and Arabic/Urdu right-to-left flow.

Some older product screens in the Urdu, Bengali, and Tamil catalogues inherit the current English source where no reviewed translation exists. This fallback is intentional and visible in the catalogue merge rather than silently using outdated safety claims. It requires human translation review before those languages are advertised as fully localized for production.
