import { test, expect } from "@playwright/test"

test.describe("Battra AI Brand Assets", () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the brand preview page
    await page.goto("/brand")
  })

  test("should display the brand preview page with correct title", async ({ page }) => {
    // Check page title

    // Check main heading
    await expect(page.locator("h1")).toContainText("Battra AI Brand System")

    // Check description
    await expect(page.locator("p").first()).toContainText("AI-enhanced agile project management tool")
  })

  test("should render logo assets correctly", async ({ page }) => {
    // Check that the Zap icon is visible in navigation (Battra AI uses Zap icon instead of traditional logo)
    const zapIcon = page.locator('nav [data-testid="battra-logo"] svg')
    await expect(zapIcon).toBeVisible()

    // Check that the brand text is correct
    const brandText = page.locator('nav').locator('text=Battra AI')
    await expect(brandText).toBeVisible()

    // Check favicon previews
    const favicon16 = page.locator('img[alt="16x16 favicon"]')
    const favicon32 = page.locator('img[alt="32x32 favicon"]')
    const favicon48 = page.locator('img[alt="48x48 favicon"]')

    await expect(favicon16).toBeVisible()
    await expect(favicon32).toBeVisible()
    await expect(favicon48).toBeVisible()
  })

  test("should display color palette with correct hex values", async ({ page }) => {
    // Check that color palette section exists
    await expect(page.locator("h2").filter({ hasText: "Color Palette" })).toBeVisible()

    // Check Battra's signature yellow primary color
    const primaryColorCard = page.locator("text=Primary").locator("..").locator("..")
    await expect(primaryColorCard).toContainText("#ffcc00")
    await expect(primaryColorCard).toContainText("--battra-yellow")

    // Check Battra's red accent color
    const accentColorCard = page.locator("text=Accent").locator("..").locator("..")
    await expect(accentColorCard).toContainText("#b91c1c")
    await expect(accentColorCard).toContainText("--battra-red")

    // Check dark background color
    const backgroundCard = page.locator("text=Background").locator("..").locator("..")
    await expect(backgroundCard).toContainText("#0a0a0a")
  })

  test("should apply brand colors to button variants correctly", async ({ page }) => {
    // Navigate to button showcase section
    const buttonSection = page.locator("h3").filter({ hasText: "Button Variants" })
    await expect(buttonSection).toBeVisible()

    // Check primary button has correct background color
    const primaryButton = page.locator("button").filter({ hasText: "Primary" }).first()
    await expect(primaryButton).toBeVisible()

    // Get computed styles to verify colors are applied
    const primaryBgColor = await primaryButton.evaluate((el) => {
      return window.getComputedStyle(el).backgroundColor
    })

    // Convert hex to rgb for comparison (CSS returns rgb values)
    // #ffcc00 = rgb(255, 204, 0) - Battra's yellow
    expect(primaryBgColor).toBe("rgb(255, 204, 0)")

    // Check destructive button (using Battra's red)
    const destructiveButton = page.locator("button").filter({ hasText: "Destructive" }).first()
    await expect(destructiveButton).toBeVisible()

    const destructiveBgColor = await destructiveButton.evaluate((el) => {
      return window.getComputedStyle(el).backgroundColor
    })

    // #b91c1c = rgb(185, 28, 28) - Battra's red
    expect(destructiveBgColor).toBe("rgb(185, 28, 28)")
  })

  test("should display typography sections correctly", async ({ page }) => {
    // Check typography section exists
    await expect(page.locator("h2").filter({ hasText: "Typography" })).toBeVisible()

    // Check heading font family (Space Grotesk)
    const headingSection = page.locator("text=Headings - Space Grotesk")
    await expect(headingSection).toBeVisible()

    // Check body text font family (Inter)
    const bodySection = page.locator("text=Body Text - Inter")
    await expect(bodySection).toBeVisible()

    // Verify font families are applied
    const h1Element = page.locator("h1").filter({ hasText: "Heading 1" })
    const fontFamily = await h1Element.evaluate((el) => {
      return window.getComputedStyle(el).fontFamily
    })

    // Should contain Space Grotesk in the font stack
    expect(fontFamily).toContain("Space Grotesk")
  })

  test("should display all component showcases", async ({ page }) => {
    // Check all component sections are present
    await expect(page.locator("h3").filter({ hasText: "Button Variants" })).toBeVisible()
    await expect(page.locator("h3").filter({ hasText: "Card Layout" })).toBeVisible()
    await expect(page.locator("h3").filter({ hasText: "Form Elements" })).toBeVisible()
    await expect(page.locator("h3").filter({ hasText: "Badge Variants" })).toBeVisible()
    await expect(page.locator("h3").filter({ hasText: "Kanban Board" })).toBeVisible()

    // Check that form elements are interactive
    const projectNameInput = page.locator('input[placeholder="Enter project name"]')
    await expect(projectNameInput).toBeVisible()
    await projectNameInput.fill("Test Project")
    await expect(projectNameInput).toHaveValue("Test Project")

    // Check that select dropdown works
    const statusSelect = page.locator("select").first()
    await expect(statusSelect).toBeVisible()
    await statusSelect.selectOption("in-progress")
    await expect(statusSelect).toHaveValue("in-progress")
  })

  test("should display accessibility information", async ({ page }) => {
    // Check accessibility section
    await expect(page.locator("h2").filter({ hasText: "Accessibility" })).toBeVisible()

    // Check color contrast information
    await expect(page.locator("text=Color Contrast")).toBeVisible()
    await expect(page.locator("text=WCAG AA standards")).toBeVisible()

    // Check interactive elements information
    await expect(page.locator("text=Interactive Elements")).toBeVisible()
    await expect(page.locator("text=focus indicators")).toBeVisible()
  })

  test("should display usage guidelines", async ({ page }) => {
    // Check usage guidelines section
    await expect(page.locator("h2").filter({ hasText: "Usage Guidelines" })).toBeVisible()

    // Check all guideline subsections
    await expect(page.locator("h3").filter({ hasText: "Logo Usage" })).toBeVisible()
    await expect(page.locator("h3").filter({ hasText: "Color Application" })).toBeVisible()
    await expect(page.locator("h3").filter({ hasText: "Typography" })).toBeVisible()
  })

  test("should have proper navigation", async ({ page }) => {
    // Check that navigation bar is present
    const nav = page.locator("nav")
    await expect(nav).toBeVisible()

    // Check navigation Zap icon
    const zapIcon = nav.locator('svg[data-testid="zap-icon"]')
    await expect(zapIcon).toBeVisible()

    // Check navigation brand text
    await expect(page.locator("nav").locator("text=Battra AI")).toBeVisible()

    // Check navigation menu items
    await expect(page.locator("nav a").filter({ hasText: "Dashboard" })).toBeVisible()
    await expect(page.locator("nav a").filter({ hasText: "Projects" })).toBeVisible()
    await expect(page.locator("nav a").filter({ hasText: "Team" })).toBeVisible()
    await expect(page.locator("nav a").filter({ hasText: "Reports" })).toBeVisible()
  })

  test("should take screenshot for visual regression baseline", async ({ page }) => {
    // Wait for all images to load
    await page.waitForLoadState("networkidle")

    // Take full page screenshot
    await expect(page).toHaveScreenshot("brand-preview-full-page.png", {
      fullPage: true,
      animations: "disabled",
    })

    // Take screenshot of just the logo section
    const logoSection = page.locator("h2").filter({ hasText: "Logo Assets" }).locator("..")
    await expect(logoSection).toHaveScreenshot("brand-logo-section.png")

    // Take screenshot of color palette
    const colorSection = page.locator("h2").filter({ hasText: "Color Palette" }).locator("..")
    await expect(colorSection).toHaveScreenshot("brand-color-palette.png")

    // Take screenshot of button variants
    const buttonSection = page.locator("h3").filter({ hasText: "Button Variants" }).locator("..")
    await expect(buttonSection).toHaveScreenshot("brand-button-variants.png")
  })

  test("should be responsive on mobile devices", async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 })

    // Check that content is still visible and accessible
    await expect(page.locator("h1")).toBeVisible()
    await expect(page.locator("nav").locator("text=Battra AI")).toBeVisible()

    // Check that navigation adapts to mobile
    const nav = page.locator("nav")
    await expect(nav).toBeVisible()

    // Take mobile screenshot
    await expect(page).toHaveScreenshot("brand-preview-mobile.png", {
      fullPage: true,
      animations: "disabled",
    })
  })

  test("should have proper focus management for accessibility", async ({ page }) => {
    // Test keyboard navigation
    await page.keyboard.press("Tab")

    // Check that focusable elements receive focus
    const primaryButton = page.locator("button").filter({ hasText: "Primary" }).first()
    await primaryButton.focus()
    await expect(primaryButton).toBeFocused()

    // Check that focus indicators are visible
    const focusRing = await primaryButton.evaluate((el) => {
      return window.getComputedStyle(el, ":focus").outline
    })

    // Should have some form of focus indicator
    expect(focusRing).not.toBe("none")
  })
})

