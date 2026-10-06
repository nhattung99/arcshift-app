---
name: ArcShift
colors:
  surface: '#131313'
  surface-dim: '#131313'
  surface-bright: '#3a3939'
  surface-container-lowest: '#0e0e0e'
  surface-container-low: '#1c1b1b'
  surface-container: '#201f1f'
  surface-container-high: '#2a2a2a'
  surface-container-highest: '#353534'
  on-surface: '#e5e2e1'
  on-surface-variant: '#c2c6d6'
  inverse-surface: '#e5e2e1'
  inverse-on-surface: '#313030'
  outline: '#8c909f'
  outline-variant: '#424754'
  surface-tint: '#adc6ff'
  primary: '#adc6ff'
  on-primary: '#002e6a'
  primary-container: '#4d8eff'
  on-primary-container: '#00285d'
  inverse-primary: '#005ac2'
  secondary: '#d0bcff'
  on-secondary: '#3c0091'
  secondary-container: '#571bc1'
  on-secondary-container: '#c4abff'
  tertiary: '#4cd7f6'
  on-tertiary: '#003640'
  tertiary-container: '#009eb9'
  on-tertiary-container: '#002f38'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#d8e2ff'
  primary-fixed-dim: '#adc6ff'
  on-primary-fixed: '#001a42'
  on-primary-fixed-variant: '#004395'
  secondary-fixed: '#e9ddff'
  secondary-fixed-dim: '#d0bcff'
  on-secondary-fixed: '#23005c'
  on-secondary-fixed-variant: '#5516be'
  tertiary-fixed: '#acedff'
  tertiary-fixed-dim: '#4cd7f6'
  on-tertiary-fixed: '#001f26'
  on-tertiary-fixed-variant: '#004e5c'
  background: '#131313'
  on-background: '#e5e2e1'
  surface-variant: '#353534'
typography:
  display-lg:
    fontFamily: Sora
    fontSize: 48px
    fontWeight: '700'
    lineHeight: 56px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Sora
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 40px
    letterSpacing: -0.01em
  headline-lg-mobile:
    fontFamily: Sora
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  label-mono:
    fontFamily: Geist
    fontSize: 14px
    fontWeight: '500'
    lineHeight: 20px
    letterSpacing: 0.05em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  unit: 4px
  container-max: 1280px
  gutter: 24px
  margin-mobile: 16px
  margin-desktop: 40px
---

## Brand & Style
The design system embodies a premium "Cosmic Dark" aesthetic, specifically tailored for the high-stakes environment of Web3. It seeks to evoke a sense of immense depth, technical precision, and ethereal beauty. The interface mimics a high-end command bridge—sophisticated, calm, and unmistakably futuristic.

The design style is a refined **Glassmorphism**, moving away from heavy blurs toward high-clarity translucency. By utilizing deep space blacks as the foundation and layering them with subtle nebula gradients and electric blue "light leaks," the UI feels like it is floating in a void. High-contrast typography and razor-thin borders ensure that despite the atmospheric effects, the functional data remains the absolute priority.

## Colors
The palette is rooted in the "Deep Space" black (`#050505`), which serves as the canvas for all layers. 

- **Primary (Electric Blue):** Used for critical actions, active states, and primary interactive glows.
- **Secondary (Nebula Purple):** Applied to decorative accents, progress indicators, and background "plasma" blurs to add depth.
- **Tertiary (Cyan Glow):** Reserved for success states, data highlights, and secondary interactive elements.
- **Neutrals:** A range of cool grays with subtle blue undertones are used for borders and secondary text to maintain the "cosmic" temperature.

Surface colors should never be fully opaque. Use varying degrees of transparency (80% to 40%) to allow the underlying nebula gradients to bleed through.

## Typography
The typography system balances futuristic geometry with technical utility.

- **Sora** is utilized for headlines and display text, providing a geometric, wide-stanced look that feels modern and expansive.
- **Inter** handles the heavy lifting of body copy, ensuring maximum readability for complex transaction data and descriptions.
- **Geist** (Monospaced) is used for "Terminal Labels," wallet addresses, and numerical data to reinforce the dApp's technical nature.

Hierarchy is maintained through drastic weight shifts and purposeful tracking. Large display headings should use tighter tracking, while small mono labels should use increased tracking for a "coded" appearance.

## Layout & Spacing
The design system employs a **Fluid Grid** model with generous "breathing room" to maintain a premium feel. 

- **Desktop:** A 12-column grid with a 1280px max-width container. 
- **Rhythm:** All spacing is derived from a 4px base unit. 
- **Negative Space:** Use intentionally large margins around "Terminal Cards" to emphasize their floating nature. 

Layouts should be centered and symmetrical where possible to evoke stability. On mobile, the grid collapses to 4 columns, and glassmorphic blurs are reduced in complexity to maintain performance.

## Elevation & Depth
Depth is created through **Glassmorphism** and luminosity rather than traditional drop shadows.

- **Surface Tiers:** Background is the base (`#050505`). Mid-ground cards use a 60% opaque dark fill with a `backdrop-filter: blur(12px)`.
- **Subtle Borders:** Every glass element must have a 1px solid border. Use a top-down linear gradient for the border (White at 20% opacity to White at 5% opacity) to simulate a "light catch" on the top edge.
- **Inner Glows:** Interactive elements use a subtle inner-shadow (0px 1px 2px) in Electric Blue to suggest the element is filled with light.
- **Outer Accents:** Floating cards use a very soft, large-radius (64px) outer glow in Nebula Purple at 10% opacity to "lift" them from the void.

## Shapes
The shape language is "Rounded-Technical." Containers use a 0.5rem (8px) corner radius to feel approachable yet structured. 

Interactive components like buttons use a "Pill" shape (rounded-full) to provide a distinct contrast against the rectangular structure of the Terminal Cards. Insets for input fields and nested containers should use a slightly smaller radius (4px) to maintain visual nesting logic.

## Components

### Sleek Navigation Bar
The top navigation is a floating, slim bar with a high-blur glass background. Use a bottom-only 1px border. Navigation links use `label-mono` typography, transitioning from a dimmed gray to Electric Blue on hover.

### Glassmorphic Terminal Cards
The primary container for dApp logic. Cards feature a dark translucent fill and a subtle top-left light catch. Headers within cards should have a thin separator line (10% white opacity) and use `Sora` for titles.

### Buttons & Chips
- **Primary Button:** Solid Electric Blue with a high-intensity cyan outer glow on hover.
- **Secondary Button:** Ghost style with a thin 1px border and 5% white fill.
- **Chips:** Small, mono-spaced tags with a 20% opacity background of their respective status color (e.g., Green for "Confirmed").

### Input Fields
Inputs are dark, recessed rectangles with a 1px border. On focus, the border glows Electric Blue, and a subtle radial gradient of blue appears behind the text field to simulate depth.

### Footer Credits
A minimalist area using `Inter` at a small scale (12px). All text should be at 40% opacity, only brightening to 100% on direct interaction. No borders; use simple vertical spacing to separate it from the main content.