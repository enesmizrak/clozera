import { useHotkeys } from '@tanstack/react-hotkeys'

const CHOICE_KEYS = ['1', '2', '3', '4'] as const
const OVERLAY_SELECTOR =
  'dialog[open], [role="dialog"], [role="alertdialog"], [role="menu"], [role="listbox"]'

/** Base UI keeps closed popups mounted inside a `hidden` positioner, so only visible ones count. */
function overlayOpen() {
  return [...document.querySelectorAll(OVERLAY_SELECTOR)].some(overlay => !overlay.closest('[hidden]'))
}

/**
 * Keys 1–4 pick the matching choice. Single keys already skip focused text fields and widgets
 * (`ignoreInputs: 'auto'`); an open overlay owns the keyboard too, and a held key answers once.
 */
export function useChoiceHotkeys<T>(choices: readonly T[], pick: (choice: T) => void, enabled: boolean) {
  useHotkeys(
    CHOICE_KEYS.map((key, index) => ({
      hotkey: key,
      callback: () => {
        const choice = choices[index]
        if (choice !== undefined && !overlayOpen()) pick(choice)
      },
    })),
    { enabled, requireReset: true, ignoreDefaultPrevented: true }
  )
}
