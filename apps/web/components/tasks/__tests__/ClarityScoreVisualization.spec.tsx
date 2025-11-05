import React from 'react'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, beforeEach } from 'vitest'
import { ClarityScoreVisualization } from '@/components/tasks/ClarityScoreVisualization'

const baseProps = {
  taskId: 'task-clarity-123',
  clarityScore: {
    score: 62,
    level: 'fair',
    dimensions: [
      {
        id: 'technical',
        label: 'Technical Detail',
        score: 38,
        weight: 0.3,
        summary: 'Missing concrete technical implementation details',
        recommendations: [
          'Add file paths to modify',
          'Identify functions or components to update',
          'Define expected inputs and outputs',
          'Outline technical approach or architecture decisions',
        ],
        tooltip: 'Provide file paths, function names, expected inputs/outputs, and architecture notes.',
      },
      {
        id: 'specificity',
        label: 'Specificity',
        score: 55,
        weight: 0.25,
        summary: 'Task description uses vague verbs and lacks measurable outcomes',
        recommendations: [
          'Replace "implement" with the exact method or module name',
          'Describe measurable outcomes for completion',
        ],
        tooltip: 'Flag vague phrases and replace them with concrete, measurable actions.',
      },
      {
        id: 'completeness',
        label: 'Completeness',
        score: 72,
        weight: 0.25,
        summary: 'Some acceptance criteria references are missing',
        recommendations: [
          'Reference acceptance criteria AC-123 and AC-456',
          'Clarify non-functional requirements impacted',
        ],
        tooltip: 'Ensure each acceptance criterion is linked and described.',
      },
      {
        id: 'testability',
        label: 'Testability',
        score: 48,
        weight: 0.2,
        summary: 'Test coverage expectations not documented',
        recommendations: [
          'List expected automated and manual test cases',
          'Document mocks or fixtures required for testing',
        ],
        tooltip: 'Document test coverage expectations and supporting artifacts.',
      },
    ],
  },
  flaggedTerms: [
    {
      term: 'implement',
      context: 'Implement realtime sync',
      recommendation: 'Specify which service or function should be implemented.',
    },
    {
      term: 'build',
      context: 'Build dashboard improvements',
      recommendation: 'List the specific UI components and states to update.',
    },
  ],
  missingAcceptanceCriteria: {
    ids: ['e0261453', '81054dee'],
    recommendation:
      'Link the concrete acceptance criteria IDs that this task will satisfy to support traceability.',
  },
  aiReadiness: {
    successCriteria: false,
    dependencies: false,
    environmentSetup: false,
    testCoverage: false,
    definitionOfDone: false,
    guidance: [
      'Define explicit success criteria for the agent to verify completion.',
      'List upstream dependencies or feature flags that must be enabled.',
      'Document required environment setup scripts and secrets.',
      'Specify expected automated and manual test coverage.',
      'Clarify definition of done items such as documentation or demos.',
    ],
  },
  enrichmentSuggestion: {
    summary:
      'LLM suggests updating the task description with explicit module names (services/task-readiness/analyzer.ts), acceptance criteria references (AC-123, AC-456), and acceptance test scenarios.',
    confidence: 0.82,
    recommendedUpdates: [
      'Add technical approach outlining scoring calculation in services/readiness/analyzer.rs',
      'Reference the Story acceptance criteria AC-123 and AC-456 explicitly',
      'Document expected Vitest and Playwright coverage',
    ],
  },
  examples: [
    {
      title: 'Improve backlog clustering accuracy',
      description:
        'Update services/context-orchestrator/cluster.rs and add Playwright regression suite for clustering workflows.',
      source: 'project',
      applyLabel: 'Apply this structure',
    },
  ],
}

describe('ClarityScoreVisualization (spec)', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
  })

  const renderComponent = (overrides: Record<string, unknown> = {}) =>
    render(<ClarityScoreVisualization {...baseProps} {...overrides} />)

  it('should render clarity gauge with score, level, and semantic progress role', () => {
    // @spec-test: e0261453-8f72-4b08-8290-d8fb7903c869
    renderComponent()

    const gauge = screen.getByRole('progressbar', { name: /clarity score/i })
    expect(gauge).toHaveAttribute('aria-valuemin', '0')
    expect(gauge).toHaveAttribute('aria-valuemax', '100')
    expect(gauge).toHaveAttribute('aria-valuenow', '62')
    expect(screen.getByText('62')).toBeInTheDocument()
    expect(screen.getByText(/fair/i)).toBeInTheDocument()
  })

  it('should expose dimension breakdown with tooltips for technical, specificity, completeness, and testability', async () => {
    // @spec-test: e0261453-8f72-4b08-8290-d8fb7903c869, 81054dee-14c5-455f-a580-7d8870ba34ee
    renderComponent()

    const dimensionIds = ['technical', 'specificity', 'completeness', 'testability']
    for (const id of dimensionIds) {
      const dimension = screen.getByTestId(`clarity-dimension-${id}`)
      expect(dimension).toBeInTheDocument()
      expect(within(dimension).getByText(new RegExp(id, 'i'))).toBeInTheDocument()
    }

    await userEvent.hover(screen.getByTestId('clarity-dimension-technical'))
    expect(await screen.findByText(/Provide file paths, function names/i)).toBeVisible()
  })

  it('should list technical detail recommendations covering files, functions, inputs, and architecture', async () => {
    // @spec-test: 81054dee-14c5-455f-a580-7d8870ba34ee
    renderComponent()

    await userEvent.click(screen.getByRole('button', { name: /Technical Detail/i }))

    expect(screen.getByText(/Add file paths to modify/i)).toBeInTheDocument()
    expect(screen.getByText(/Identify functions or components to update/i)).toBeInTheDocument()
    expect(screen.getByText(/Define expected inputs and outputs/i)).toBeInTheDocument()
    expect(screen.getByText(/Outline technical approach or architecture decisions/i)).toBeInTheDocument()
  })

  it('should flag ambiguous language and request concrete actions', () => {
    // @spec-test: 30639999-a0b1-4381-b92b-173a7d946bc8
    renderComponent()

    const flaggedSection = screen.getByRole('region', { name: /Ambiguous language flagged/i })
    expect(flaggedSection).toBeInTheDocument()

    const implementBadge = within(flaggedSection).getByText(/implement/i)
    expect(implementBadge).toBeInTheDocument()
    expect(
      within(flaggedSection).getByText(
        /Specify which service or function should be implemented\./i,
      ),
    ).toBeInTheDocument()
    expect(
      within(flaggedSection).getByText(
        /List the specific UI components and states to update\./i,
      ),
    ).toBeInTheDocument()
  })

  it('should prompt linking acceptance criteria references with suggested IDs', () => {
    // @spec-test: 5649e91e-043f-4097-916b-9907620bff3e
    renderComponent()

    const acSection = screen.getByRole('region', { name: /Acceptance Criteria Coverage/i })
    expect(acSection).toBeInTheDocument()
    expect(within(acSection).getByText(/e0261453/i)).toBeInTheDocument()
    expect(within(acSection).getByText(/81054dee/i)).toBeInTheDocument()
    expect(
      within(acSection).getByText(
        /Link the concrete acceptance criteria IDs that this task will satisfy/i,
      ),
    ).toBeInTheDocument()
  })

  it('should render AI agent readiness checklist highlighting missing items', () => {
    // @spec-test: 3f42fa09-1117-463b-b523-08dc03a2f4a4
    renderComponent()

    const readiness = screen.getByRole('region', { name: /AI agent readiness/i })
    expect(readiness).toBeInTheDocument()

    const checklistItems = [
      'Clear success criteria',
      'Explicit dependencies',
      'Environment setup',
      'Expected test coverage',
      'Definition of done',
    ]

    for (const item of checklistItems) {
      const row = within(readiness).getByTestId(`ai-readiness-${item.replace(/\s+/g, '-').toLowerCase()}`)
      expect(row).toHaveAttribute('data-status', 'missing')
      expect(within(row).getByText(new RegExp(item, 'i'))).toBeInTheDocument()
    }
  })

  it('should surface AI-assisted enrichment suggestion with confidence indicator', () => {
    // @spec-test: dd7b8a3c-2689-4a11-9c0d-e46843a0be1d
    renderComponent()

    const suggestionSection = screen.getByRole('region', { name: /AI-assisted enrichment suggestion/i })
    expect(suggestionSection).toBeInTheDocument()
    expect(within(suggestionSection).getByText(/82% confidence/i)).toBeInTheDocument()
    expect(
      within(suggestionSection).getByRole('button', { name: /Review suggested update/i }),
    ).toBeInTheDocument()
    expect(
      within(suggestionSection).getByText(
        /services\/task-readiness\/analyzer\.ts/i,
      ),
    ).toBeInTheDocument()
  })

  it('should expose well-defined task examples with one-click apply action', () => {
    // @spec-test: bbd83897-f34c-4c09-a280-a965c0937d04
    renderComponent()

    const examples = screen.getByRole('region', { name: /Well-defined task examples/i })
    expect(examples).toBeInTheDocument()

    expect(within(examples).getByText(/Improve backlog clustering accuracy/i)).toBeInTheDocument()
    expect(
      within(examples).getByRole('button', { name: /Apply this structure/i }),
    ).toBeInTheDocument()
  })
})
