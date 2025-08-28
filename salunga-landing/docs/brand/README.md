# Salunga Brand Assets

This directory contains the complete brand system for Salunga, including guidelines, assets, and implementation resources.

## Quick Start

1. **View the brand preview**: Visit `/brand` to see all components and colors in action
2. **Read the guidelines**: See `brand-guidelines.md` for comprehensive usage instructions
3. **Import the theme**: Use `tailwind.salunga.config.ts` in your Tailwind configuration
4. **Use components**: Import components from `@/components/salunga/`

## Files Overview

- `brand-guidelines.md` - Complete brand guidelines and usage instructions
- `../public/logo-*` - Logo assets in various formats
- `../tailwind.salunga.config.ts` - Tailwind theme configuration
- `../components/salunga/` - React component library
- `../tests/brand.spec.ts` - Automated brand testing

## Testing

Run brand tests to ensure consistency:

\`\`\`bash
npx playwright test tests/brand.spec.ts
\`\`\`

## Implementation Checklist

- [ ] Logo displays correctly with proper alt text
- [ ] Colors match the defined palette
- [ ] Typography uses Space Grotesk for headings, Inter for body
- [ ] Components follow accessibility guidelines
- [ ] All interactive elements have focus indicators
- [ ] Color contrast meets WCAG AA standards

## Support

For questions about brand implementation, refer to the brand guidelines or contact the design team.
