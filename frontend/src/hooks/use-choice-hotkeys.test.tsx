import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vite-plus/test'
import { useChoiceHotkeys } from './use-choice-hotkeys'

function Harness({ pick, enabled = true }: { pick: (choice: string) => void; enabled?: boolean }) {
  useChoiceHotkeys(['alpha', 'beta', 'gamma'], pick, enabled)
  return <input aria-label="Note" />
}

describe('useChoiceHotkeys', () => {
  it('picks the choice for a number key', async () => {
    const pick = vi.fn<(choice: string) => void>()
    render(<Harness pick={pick} />)
    await userEvent.keyboard('2')
    expect(pick).toHaveBeenCalledExactlyOnceWith('beta')
  })

  it('ignores keys without a choice, while disabled, or while typing', async () => {
    const pick = vi.fn<(choice: string) => void>()
    const { rerender } = render(<Harness pick={pick} />)
    await userEvent.keyboard('4')
    await userEvent.type(screen.getByRole('textbox', { name: 'Note' }), '1')
    rerender(<Harness pick={pick} enabled={false} />)
    screen.getByRole('textbox', { name: 'Note' }).blur()
    await userEvent.keyboard('1')
    expect(pick).not.toHaveBeenCalled()
  })

  it('leaves the keyboard to an open overlay', async () => {
    const pick = vi.fn<(choice: string) => void>()
    render(
      <>
        <Harness pick={pick} />
        <dialog open aria-label="Open" />
      </>
    )
    await userEvent.keyboard('1')
    expect(pick).not.toHaveBeenCalled()
  })

  it('ignores overlays that are mounted but closed', async () => {
    const pick = vi.fn<(choice: string) => void>()
    render(
      <>
        <Harness pick={pick} />
        <div hidden>
          {/* Mirrors the closed Base UI Select popup. */}
          {/* oxlint-disable-next-line jsx-a11y/prefer-tag-over-role */}
          <div role="listbox" aria-label="Closed" />
        </div>
      </>
    )
    await userEvent.keyboard('3')
    expect(pick).toHaveBeenCalledExactlyOnceWith('gamma')
  })
})
