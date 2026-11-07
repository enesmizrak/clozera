import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vite-plus/test'
import { SentenceForm } from './sentence-form'

describe('SentenceForm', () => {
  it('requires exactly one cloze marker before submitting', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn<(input: unknown) => Promise<void>>().mockResolvedValue()
    render(<SentenceForm onSubmit={onSubmit} />)

    await user.type(screen.getByLabelText('Sentence'), 'Ich lerne heute.')
    await user.type(screen.getByLabelText('Translation'), 'I learn today.')
    await user.click(screen.getByRole('button', { name: 'Add sentence' }))

    expect(
      await screen.findByText(/Mark exactly one missing word/, {
        selector: '[data-slot="field-error"] *, [data-slot="field-error"]',
      })
    ).toBeTruthy()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('previews the cloze and submits the sentence', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn<(input: unknown) => Promise<void>>().mockResolvedValue()
    render(<SentenceForm onSubmit={onSubmit} />)

    await user.type(screen.getByLabelText('Sentence'), 'Ich {{{{lerne}} heute.')
    await user.type(screen.getByLabelText('Translation'), 'I learn today.')
    await user.type(screen.getByLabelText('Alternative answers'), 'studiere, übe')

    expect(screen.getByLabelText('Sentence preview').textContent).toBe('Ich lerne heute.')
    await user.click(screen.getByRole('button', { name: 'Add sentence' }))

    expect(onSubmit).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        text: 'Ich {{lerne}} heute.',
        translation: 'I learn today.',
        alternativeAnswers: 'studiere, übe',
      })
    )
  })

  it('shows server errors from the save callback', async () => {
    const user = userEvent.setup()
    render(
      <SentenceForm
        sentence={{
          id: 's1',
          text: 'Ich {{lerne}}.',
          translation: 'I learn.',
          cloze: 'lerne',
          alternativeAnswers: [],
          multipleChoiceOptions: [],
          hint: '',
          notes: '',
        }}
        onSubmit={() => Promise.reject(new Error('Only the collection owner can change this collection.'))}
      />
    )

    await user.click(screen.getByRole('button', { name: 'Save sentence' }))
    expect(await screen.findByText('Only the collection owner can change this collection.')).toBeTruthy()
  })
})
