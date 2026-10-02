# Lakshly design tokens

Shared web/native reference. System font stack only; no downloaded assets. Semantic money colors are separate from brand gold and lotus pink. Light and dark values below are resolved independently; shared tokens inherit the light value.

| Token | Light value | Dark value | Usage |
| --- | --- | --- | --- |
| `--lk-bg` | `#FBF8F1` | `#0E1430` | Canvas |
| `--lk-surface` | `#F5F4F9` | `#1A2344` | Opaque card / contrast reference |
| `--lk-surface-2` | `#EAEAF3` | `#263152` | Selected controls and status backgrounds |
| `--lk-text` | `#19213E` | `#F3F4FC` | Primary text |
| `--lk-text-muted` | `#59617A` | `#B5BFD8` | Secondary labels and axes |
| `--lk-border` | `#C4C8D8` | `#465275` | Controls and glass rims |
| `--lk-gold` | `#D9A93F` | `#D9A93F` | Logo, net worth and primary button fill; not small text |
| `--lk-gold-text` | `#765510` | `#E9BF62` | Accessible gold labels and Premium |
| `--lk-lotus` | `#E8789A` | `#E8789A` | Sparing category accent; not text |
| `--lk-income` | `#087852` | `#63D4AA` | Income / growth chart series |
| `--lk-spend` | `#AB443E` | `#F6ADA4` | Spend chart series |
| `--lk-invest` | `#087B80` | `#6CCED2` | Investment series |
| `--lk-danger` | `#B52D45` | `#FF9AAC` | Negative values and warnings |
| `--lk-success` | `#087852` | `#63D4AA` | Positive values and shipped status |
| `--lk-indigo` | `#535EAA` | `#A6AEEE` | Category and planned status |
| `--lk-blue` | `#356CA7` | `#90BAEB` | Category and received status |
| `--lk-glass` | `rgba(245,244,249,.64)` | `rgba(26,35,68,.52)` | Translucent panel fill |
| `--lk-glass-strong` | `rgba(245,244,249,.88)` | `rgba(26,35,68,.84)` | Navigation and tooltip glass |
| `--lk-highlight` | `rgba(255,255,255,.92)` | `rgba(218,226,255,.48)` | Specular top and side rim |
| `--lk-grid` | `rgba(25,33,62,.065)` | `rgba(215,225,255,.07)` | Dividers / chart guides |
| `--lk-shadow` | `0 18px 48px -28px rgba(14,20,48,.28), 0 3px 10px -5px rgba(14,20,48,.12)` | `0 24px 64px -28px rgba(0,0,0,.65), 0 4px 12px -6px rgba(0,0,0,.32)` | Floating depth |
| `--lk-blur` | `32px` | `32px` | Backdrop blur |
| `--lk-radius` | `28px` | `28px` | Panels |
| `--lk-radius-sm` | `16px` | `16px` | Controls and tooltips |
| `--lk-motion` | `420ms` | `420ms` | Interaction duration |
| `--lk-spring` | `cubic-bezier(.22,1.2,.36,1)` | `cubic-bezier(.22,1.2,.36,1)` | Spring-like CSS easing |
| `--lk-hero` | `#151E40` | `#151E40` | Net-worth card |
| `--lk-hero-text` | `#F7F5ED` | `#F7F5ED` | Text on hero |
| `--lk-hero-muted` | `#C3CAE1` | `#C3CAE1` | Secondary hero text |
| `--lk-on-gold` | `#231B09` | `#231B09` | Primary button text |
| `--lk-ambient-indigo` | `rgba(98,108,180,.18)` | `rgba(98,108,180,.28)` | Cool ambient light |
| `--lk-ambient-gold` | `rgba(217,169,63,.08)` | `rgba(217,169,63,.09)` | Subtle brand ambient light |
| `--lk-elevation-1` | `0 8px 24px -16px rgba(14,20,48,.24)` | `0 8px 24px -12px rgba(0,0,0,.4)` | Controls and sticky day headers |
| `--lk-elevation-2` | `var(--lk-shadow)` | `var(--lk-shadow)` | Resting panels |
| `--lk-elevation-3` | `0 28px 64px -24px rgba(14,20,48,.32), 0 8px 20px -10px rgba(14,20,48,.18)` | `0 28px 64px -18px rgba(0,0,0,.65), 0 8px 20px -8px rgba(0,0,0,.4)` | Hover, floating navigation and tooltips |
| `--lk-inner-glow` | `rgba(255,255,255,.18)` | `rgba(166,174,238,.07)` | Soft optical panel glow |
| `--lk-sheen` | `rgba(217,169,63,.18)` | same | Gold hero reflection |
| `--lk-focus` | `var(--lk-gold-text)` | same | 3px focus ring, 4px offset |
| `--lk-saturate` | `165%` | same | Backdrop saturation |
| `--lk-display` | `clamp(2.8rem,5.6vw,4.6rem)` | same | Hero numerals; mobile `clamp(2.5rem,10vw,3.6rem)` |
| `--lk-title` | `clamp(2rem,3vw,2.8rem)` | same | Page title |
| `--lk-headline` | `1.05rem` | same | Card headings |
| `--lk-body` | `.9375rem` | same | Body copy |
| `--lk-caption` | `.75rem` | same | Captions, chart axes and day headers |
| `--lk-number` | `clamp(1.2rem,1.8vw,1.7rem)` | same | Stat numerals |
| `--lk-chart-motion` | `700ms` | same | Recharts spring duration (numeric mirror in charts.tsx) |
| `--lk-tab-height` | `68px` | same | Floating navigation and content clearance |

## Contrast verification

WCAG relative luminance, opaque sRGB tokens. Normal text requires 4.5:1. Glass uses 64% surface opacity in light and 52% in dark (88% / 84% for floating controls). Ambient layers remain bounded; solid surface tokens also serve as native and reduced-transparency fallbacks. Focus uses accessible gold text, with at least 5.71:1 / 7.36:1 against the selected surface (above the 3:1 non-text requirement). Ratios below include the canvas and the lighter selected/status surface.

| Foreground | Background | Light | Dark |
| --- | --- | --- | --- |
| `--lk-text` | `--lk-bg` | 14.90:1 | 16.49:1 |
| `--lk-text` | `--lk-surface` | 14.45:1 | 14.01:1 |
| `--lk-text` | `--lk-surface-2` | 13.22:1 | 11.66:1 |
| `--lk-text-muted` | `--lk-bg` | 5.80:1 | 9.82:1 |
| `--lk-text-muted` | `--lk-surface` | 5.62:1 | 8.34:1 |
| `--lk-text-muted` | `--lk-surface-2` | 5.14:1 | 6.94:1 |
| `--lk-danger` | `--lk-bg` | 5.78:1 | 9.01:1 |
| `--lk-danger` | `--lk-surface` | 5.60:1 | 7.65:1 |
| `--lk-danger` | `--lk-surface-2` | 5.13:1 | 6.37:1 |
| `--lk-success` | `--lk-bg` | 5.18:1 | 9.93:1 |
| `--lk-success` | `--lk-surface` | 5.03:1 | 8.43:1 |
| `--lk-success` | `--lk-surface-2` | 4.60:1 | 7.01:1 |
| `--lk-gold-text` | `--lk-bg` | 6.43:1 | 10.41:1 |
| `--lk-gold-text` | `--lk-surface` | 6.24:1 | 8.84:1 |
| `--lk-gold-text` | `--lk-surface-2` | 5.71:1 | 7.36:1 |
| `--lk-spend` | `--lk-bg` | 5.46:1 | 9.84:1 |
| `--lk-spend` | `--lk-surface` | 5.29:1 | 8.36:1 |
| `--lk-spend` | `--lk-surface-2` | 4.84:1 | 6.96:1 |
| `--lk-on-gold` | `--lk-gold` | 7.87:1 | 7.87:1 |
| `--lk-hero-text` | `--lk-hero` | 14.89:1 | 14.89:1 |
| `--lk-hero-muted` | `--lk-hero` | 9.95:1 | 9.95:1 |
| `--lk-gold` | `--lk-hero` | 7.51:1 | 7.51:1 |
| `--lk-indigo` | `--lk-surface-2` | 4.95:1 | 6.03:1 |
| `--lk-blue` | `--lk-surface-2` | 4.56:1 | 6.33:1 |

Additional conservative glass estimate: composite both indigo fields and the gold field at their full token alpha over the canvas, then the panel fill and both glow layers. This deliberately exceeds the actual radial overlap. These sRGB compositing estimates do not model backdrop saturation; browser pixel sampling is still needed to validate final rendered contrast. Background estimates: light `#EDEDF2`, dark `#3E446C`.

| Foreground on estimated glass | Light | Dark |
| --- | --- | --- |
| `--lk-text` | 13.52:1 | 8.48:1 |
| `--lk-text-muted` | 5.26:1 | 5.05:1 |
| `--lk-danger` | 5.24:1 | 4.63:1 |
| `--lk-success` | 4.70:1 | 5.10:1 |
| `--lk-spend` | 4.95:1 | 5.06:1 |
| `--lk-gold-text` | 5.84:1 | 5.35:1 |

## Composition and motion

Glass combines a cool translucent fill, 32px backdrop blur at 165% saturation, a masked inner 1px gradient rim brightest at the top-left, and a soft inner glow. Three elevation levels distinguish resting panels, controls and floating elements. Fixed radial indigo/gold light fields sit behind the app; there are no animated warm blobs. The midnight hero has a restrained diagonal gold reflection. Unsupported backdrop filters and `prefers-reduced-transparency: reduce` use opaque surfaces; reduced transparency also removes ambient light and the hero reflection. Gold fill always uses `--lk-on-gold`; small gold text uses `--lk-gold-text`.

All money uses tabular numerals. Display numerals use −.055em tracking, stat numerals −.04em and donut totals −.035em. Chart axes use the caption scale and compact Indian ₹ units. Donuts center the sum of their displayed categories; the Overview subset is labeled “Shown spend”. Bars use token-derived gradients and rounded corners; tooltips share the glass rim and floating elevation.

Interactions use 420ms spring-like easing. Cards and buttons respond with scale and elevation. Plan and mobile navigation indicators slide between selections. Recharts uses its built-in spring easing at 700ms; tooltip movement uses ease-out. Reduced motion disables CSS transitions, scale responses and all Recharts animation, including live preference changes. Theme colors transition smoothly.

At 390px, Budget uses three compact summary columns and Overview stats use two columns. Content reserves `--lk-tab-height + 44px + env(safe-area-inset-bottom)` below the final section, clearing the fixed pill and keyboard focus offset. Spend shows 20 rows initially, groups them by day with sticky headers, and expands via client state. Day net totals include the complete matching day (including any rows beyond the initial 20); filtered totals are labeled “Matching net”. Transfers remain neutral; income and spend use separate semantic tokens.
