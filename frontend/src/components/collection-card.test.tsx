import type { CollectionDto } from '@clozera/shared'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vite-plus/test'
import { togglePinned } from '@/data/collections'
import { PinButton } from './collection-card'

vi.mock('@/data/collections', () => ({
  togglePinned: vi.fn<() => Promise<void>>(() => new Promise<void>(() => {})),
}))

const collection = {
  id: 'c1',
  name: 'Verbs',
  isPinned: false,
  capabilities: { canPin: true, canUnpin: false },
} as unknown as CollectionDto

describe('PinButton', () => {
  it('ignores a second click while the first request is in flight', async () => {
    const user = userEvent.setup()
    render(<PinButton collection={collection} />)
    const button = screen.getByRole('button', { name: 'Add to dashboard: Verbs' })

    await user.click(button)
    await user.click(button)

    expect(togglePinned).toHaveBeenCalledTimes(1)
    expect((button as HTMLButtonElement).disabled || button.getAttribute('aria-disabled') === 'true').toBe(
      true
    )
  })
})
