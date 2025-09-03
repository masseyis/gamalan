# Salunga Brand Guidelines

## Table of Contents

1. [Brand Overview](#brand-overview)
2. [Logo System](#logo-system)
3. [Color Palette](#color-palette)
4. [Typography](#typography)
5. [Component Library](#component-library)
6. [Accessibility Standards](#accessibility-standards)
7. [Implementation Guidelines](#implementation-guidelines)
8. [Usage Examples](#usage-examples)

---

## Brand Overview

### Mission Statement

Salunga is an AI-enhanced agile project management tool designed to streamline workflows, enhance team collaboration, and deliver intelligent insights for modern development teams.

### Brand Personality

- **Professional**: Trustworthy and reliable for enterprise use
- **Modern**: Clean, contemporary design that feels current
- **Intelligent**: Sophisticated AI capabilities without complexity
- **Collaborative**: Designed for team-first experiences
- **Efficient**: Streamlined interfaces that reduce cognitive load

### Visual Principles

- **Clarity**: Every element serves a purpose
- **Consistency**: Unified experience across all touchpoints
- **Accessibility**: Inclusive design for all users
- **Scalability**: Works across devices and contexts

---

## Logo System

### Primary Logo

The Salunga wordmark combines clean typography with a distinctive hexagonal spiral icon that represents the iterative nature of agile development and the flow of intelligent automation.

#### Logo Variations

| Variation      | Usage                                          | File                             |
| -------------- | ---------------------------------------------- | -------------------------------- |
| **Full Logo**  | Primary branding, headers, marketing materials | `logo-full.svg`, `logo-full.png` |
| **Icon Only**  | Favicons, app icons, social media profiles     | `logo-icon.svg`, `logo-icon.png` |
| **Monochrome** | Single-color applications, watermarks          | `logo-mono.svg`                  |

#### Logo Usage Guidelines

**DO:**

- Use the full logo whenever space permits
- Maintain minimum clear space equal to the height of the icon
- Use on backgrounds with sufficient contrast
- Scale proportionally only

**DON'T:**

- Modify colors, proportions, or typography
- Place on busy or low-contrast backgrounds
- Use outdated or low-resolution versions
- Combine with other logos without proper spacing

#### Minimum Sizes

- **Digital**: 120px width minimum for full logo, 24px for icon only
- **Print**: 1 inch width minimum for full logo, 0.25 inch for icon only

#### Clear Space

Maintain clear space around the logo equal to the height of the hexagonal icon on all sides.

---

## Color Palette

### Primary Colors

Our color system is built around professional blues and teals that convey trust, technology, and forward-thinking innovation.

#### Brand Colors

| Color             | Hex       | RGB                  | Usage                                   |
| ----------------- | --------- | -------------------- | --------------------------------------- |
| **Primary**       | `#0ea5e9` | `rgb(14, 165, 233)`  | Main CTAs, navigation, primary actions  |
| **Primary Hover** | `#0284c7` | `rgb(2, 132, 199)`   | Hover states for primary elements       |
| **Primary Light** | `#e0f2fe` | `rgb(224, 242, 254)` | Backgrounds, subtle highlights          |
| **Accent**        | `#14b8a6` | `rgb(20, 184, 166)`  | Secondary actions, highlights, progress |
| **Accent Hover**  | `#0d9488` | `rgb(13, 148, 136)`  | Hover states for accent elements        |
| **Accent Light**  | `#ccfbf1` | `rgb(204, 251, 241)` | Accent backgrounds, notifications       |

#### Semantic Colors

| Color       | Hex       | RGB                 | Usage                           |
| ----------- | --------- | ------------------- | ------------------------------- |
| **Success** | `#22c55e` | `rgb(34, 197, 94)`  | Success states, completed tasks |
| **Warning** | `#f59e0b` | `rgb(245, 158, 11)` | Warnings, pending states        |
| **Danger**  | `#ef4444` | `rgb(239, 68, 68)`  | Errors, destructive actions     |

#### Neutral Colors

| Color                    | Hex       | RGB                  | Usage                              |
| ------------------------ | --------- | -------------------- | ---------------------------------- |
| **Background**           | `#ffffff` | `rgb(255, 255, 255)` | Primary background                 |
| **Background Secondary** | `#fafafa` | `rgb(250, 250, 250)` | Card backgrounds, sections         |
| **Background Muted**     | `#f5f5f5` | `rgb(245, 245, 245)` | Input backgrounds, disabled states |
| **Foreground**           | `#171717` | `rgb(23, 23, 23)`    | Primary text                       |
| **Foreground Secondary** | `#404040` | `rgb(64, 64, 64)`    | Secondary text                     |
| **Foreground Muted**     | `#737373` | `rgb(115, 115, 115)` | Placeholder text, captions         |
| **Border**               | `#e5e5e5` | `rgb(229, 229, 229)` | Default borders                    |

### Color Usage Guidelines

#### Primary Color Applications

- **Navigation**: Primary color for active states and main navigation elements
- **CTAs**: Primary buttons and main call-to-action elements
- **Links**: Text links and interactive elements
- **Progress**: Progress bars and completion indicators

#### Accent Color Applications

- **Secondary Actions**: Secondary buttons and alternative CTAs
- **Highlights**: Important information that needs attention
- **Status Indicators**: Active states, online indicators
- **Interactive Elements**: Hover states, focus indicators

#### Semantic Color Applications

- **Success**: Form validation, completed tasks, positive feedback
- **Warning**: Caution states, pending approvals, important notices
- **Danger**: Error states, destructive actions, critical alerts

### Accessibility Considerations

All color combinations meet WCAG AA standards with minimum contrast ratios:

- **Normal text**: 4.5:1 contrast ratio
- **Large text**: 3:1 contrast ratio
- **Interactive elements**: 3:1 contrast ratio

---

## Typography

### Font System

Our typography system uses two carefully selected typefaces that complement each other while serving distinct purposes.

#### Primary Typefaces

**Space Grotesk** - Headings and Display Text

- **Usage**: All headings (H1-H6), display text, navigation
- **Characteristics**: Geometric, modern, distinctive
- **Weights**: 400 (Regular), 500 (Medium), 600 (Semibold), 700 (Bold)

**Inter** - Body Text and UI

- **Usage**: Body text, UI elements, forms, captions
- **Characteristics**: Highly legible, optimized for screens
- **Weights**: 400 (Regular), 500 (Medium), 600 (Semibold)

#### Typography Scale

| Element        | Font          | Size            | Weight | Line Height | Usage               |
| -------------- | ------------- | --------------- | ------ | ----------- | ------------------- |
| **H1**         | Space Grotesk | 2.25rem (36px)  | 700    | 1.2         | Page titles         |
| **H2**         | Space Grotesk | 1.875rem (30px) | 600    | 1.3         | Section headers     |
| **H3**         | Space Grotesk | 1.5rem (24px)   | 600    | 1.4         | Subsection headers  |
| **H4**         | Space Grotesk | 1.25rem (20px)  | 500    | 1.4         | Component titles    |
| **H5**         | Space Grotesk | 1.125rem (18px) | 500    | 1.4         | Small headers       |
| **H6**         | Space Grotesk | 1rem (16px)     | 500    | 1.4         | Micro headers       |
| **Body Large** | Inter         | 1.125rem (18px) | 400    | 1.6         | Important body text |
| **Body**       | Inter         | 1rem (16px)     | 400    | 1.6         | Default body text   |
| **Body Small** | Inter         | 0.875rem (14px) | 400    | 1.5         | Secondary text      |
| **Caption**    | Inter         | 0.75rem (12px)  | 400    | 1.4         | Captions, metadata  |

#### Typography Guidelines

**DO:**

- Use Space Grotesk for all headings and display text
- Use Inter for body text and UI elements
- Maintain consistent line heights for readability
- Use appropriate font weights for hierarchy

**DON'T:**

- Mix additional typefaces without approval
- Use font sizes smaller than 12px for body text
- Use all caps for large blocks of text
- Ignore line height recommendations

---

## Component Library

### Button System

#### Button Variants

| Variant         | Usage                  | Background           | Text Color           | Border |
| --------------- | ---------------------- | -------------------- | -------------------- | ------ |
| **Primary**     | Main actions, CTAs     | Primary              | White                | None   |
| **Secondary**   | Secondary actions      | Background Secondary | Foreground           | Border |
| **Accent**      | Alternative CTAs       | Accent               | White                | None   |
| **Destructive** | Delete, remove actions | Danger               | White                | None   |
| **Ghost**       | Subtle actions         | Transparent          | Foreground Secondary | None   |

#### Button Sizes

| Size       | Padding   | Font Size | Usage                         |
| ---------- | --------- | --------- | ----------------------------- |
| **Small**  | 12px 16px | 14px      | Compact spaces, tables        |
| **Medium** | 16px 24px | 16px      | Default size                  |
| **Large**  | 20px 32px | 18px      | Hero sections, important CTAs |

### Card System

Cards use consistent spacing, borders, and shadows to create hierarchy and organization.

- **Background**: Background color with subtle border
- **Border Radius**: 12px for consistent rounded corners
- **Shadow**: Subtle shadow that increases on hover
- **Padding**: 24px for content areas

### Form Elements

#### Input Fields

- **Background**: Background Muted
- **Border**: Border color with Primary focus state
- **Padding**: 12px 16px
- **Border Radius**: 8px

#### Labels

- **Font**: Inter Medium
- **Size**: 14px
- **Color**: Foreground
- **Spacing**: 8px below label

### Badge System

Badges use semantic colors with light backgrounds for clear communication of status and categories.

| Type        | Background    | Text Color   | Usage               |
| ----------- | ------------- | ------------ | ------------------- |
| **Primary** | Primary Light | Primary Dark | General tags        |
| **Success** | Success Light | Success      | Completed, approved |
| **Warning** | Warning Light | Warning      | Pending, caution    |
| **Error**   | Danger Light  | Danger       | Failed, blocked     |

---

## Accessibility Standards

### Color Accessibility

- All text meets WCAG AA contrast requirements (4.5:1 for normal text, 3:1 for large text)
- Color is never the only means of conveying information
- Interactive elements have clear focus indicators

### Typography Accessibility

- Minimum font size of 14px for body text
- Line heights between 1.4-1.6 for optimal readability
- Sufficient spacing between interactive elements (minimum 44px touch targets)

### Interactive Elements

- All interactive elements have focus indicators
- Keyboard navigation is supported throughout
- Screen reader compatibility with semantic HTML and ARIA labels

### Motion and Animation

- Respect user preferences for reduced motion
- Animations enhance usability without being distracting
- Essential information is never conveyed through motion alone

---

## Implementation Guidelines

### CSS Custom Properties

Use CSS custom properties for consistent theming:

\`\`\`css
:root {
--salunga-primary: #0ea5e9;
--salunga-accent: #14b8a6;
--salunga-success: #22c55e;
--salunga-warning: #f59e0b;
--salunga-danger: #ef4444;
--salunga-bg: #ffffff;
--salunga-fg: #171717;
--salunga-border: #e5e5e5;
}
\`\`\`

### Tailwind Configuration

Import the Salunga theme configuration:

\`\`\`javascript
import { salungaTheme } from './tailwind.salunga.config'

export default {
...salungaTheme,
// Your other Tailwind config
}
\`\`\`

### Component Usage

Use the provided component library for consistent implementation:

\`\`\`jsx
import { SalungaButton, SalungaCard } from '@/components/salunga'

// Correct usage
<SalungaButton variant="primary" size="md">
Create Project
</SalungaButton>
\`\`\`

---

## Usage Examples

### Marketing Pages

- Use full logo in header
- Primary color for main CTAs
- Space Grotesk for headlines
- Generous white space

### Application Interface

- Icon logo in navigation
- Consistent button variants
- Card-based layouts
- Clear information hierarchy

### Mobile Applications

- Simplified navigation
- Touch-friendly button sizes
- Readable font sizes
- Sufficient contrast

---

## Brand Asset Files

### Logo Files

- `logo-full.svg` - Full logo (vector)
- `logo-full.png` - Full logo (raster, 512px)
- `logo-icon.svg` - Icon only (vector)
- `logo-icon.png` - Icon only (raster, 512px)

### Favicon Files

- `favicon.ico` - Standard favicon
- `favicon-16.png` - 16x16 favicon
- `favicon-32.png` - 32x32 favicon
- `favicon-48.png` - 48x48 favicon

### Configuration Files

- `tailwind.salunga.config.ts` - Tailwind theme configuration
- `brand.spec.ts` - Automated brand testing

---

## Contact and Support

For questions about brand implementation or requests for additional assets, please contact the design team or refer to the brand preview page at `/brand`.

### Version History

- **v1.0** - Initial brand system release
- **v1.1** - Added component library and accessibility guidelines
- **v1.2** - Enhanced color palette and usage guidelines

---

_Last updated: [Current Date]_
_Brand guidelines version: 1.2_
