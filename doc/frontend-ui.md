# Frontend UI and practice design standards

## Shared design source

- Color, radius and font tokens: `frontend/src/styles.css`. Fonts load locally from the
  `@fontsource-variable` packages; no third-party font requests are made.
- `primary`: the main action and the selected control. `success`: a correct answer or a
  positive self-assessment. `destructive`: a wrong answer, an error or a delete action.
- Page layout: `page-shell`; the practice screen uses `data-width="practice"` for a narrower
  reading column. Collection lists use `collection-grid`.
- Mode selection: `selection-card` is applied on top of shadcn `Label` and `RadioGroupItem`.
  Its appearance derives from the `data-selected` and `data-disabled` states.
- Controls come from the official shadcn sources in `frontend/src/components/ui` (Base UI,
  `base-vega` style). When a new control is needed, add it through the official CLI with the
  existing `components.json`. App-specific shared flows compose these controls. Base UI uses
  `render` instead of `asChild`; use the `buttonVariants()` classes to style links as buttons.
- The `@shadcn/lint` rules (inside Oxlint) reject raw Tailwind colors, unknown classes and
  dynamic class strings; arbitrary values produce warnings.
- Forms are built with TanStack Form and shadcn `Field` components (`src/components/form.tsx`);
  validation uses the Zod schemas in `@clozera/shared`, so the same rules apply as in the API.

## Collection cards

Cards show, in order: collection type/level, title, description, sentence count and actions.
The title and the arrow button open the sentence list; the labelled `Practice` button opens
the practice settings. Pinning is a separate action with its own accessible name. Practice is
disabled for empty collections, while the sentence list stays reachable.

Learning percentages, mastery or history statistics that the backend doesn't store yet are not
shown on cards. The search field stays visible; sorting applies to name or sentence count. On
mobile, cards and answer fields collapse to a single column.

The tab and the search text live in the URL (`/dashboard?tab=collections&q=...`); going back
restores the same view and scroll position. Sorting, the expanded official group headings and
the last chosen practice mode and session length are stored on the device (Zustand
`persist`). The "Practice material" chart on the dashboard (TanStack Charts) shows the sentence
counts of pinned collections as sorted horizontal bars, with an equivalent table for screen
readers.

Collection descriptions and sentence notes render as Markdown (TanStack Markdown); raw HTML is
disabled because community content comes from other learners. The sentence list is searched
and paginated with TanStack Table (25 rows).

Keyboard shortcuts are defined with TanStack Hotkeys. In a multiple-choice question, keys 1–4
select the matching option; they do nothing while focus is in a text field or a dialog/menu is
open, and a held key answers once (`src/hooks/use-choice-hotkeys.ts`).

## Practice architecture

- `src/lib/practice-session.ts`: framework-independent answer checking, shuffling, mode
  validation and session length options.
- `src/lib/practice-options.ts`: shared names, descriptions, icons, instructions and
  availability of the modes and practice types.
- `src/hooks/use-practice-session.ts`: advancing questions, revealing answers, grading and
  restarting (`useReducer`). Sentences are preloaded into a TanStack DB collection in the route
  loader.
- `src/components/practice-dialog.tsx`: presents the options with shadcn radio/select controls.
- `src/routes/_app/dashboard/collections/$collectionId/practice.tsx`: runs the same session
  behavior for the chosen answer mode.

Supported modes:

| URL `mode` value | Learner action | Session result |
| --- | --- | --- |
| `choice` | Picks the answer from the available options. | Correct / wrong |
| `typed` | Types the answer; alternative correct answers are accepted. | Correct / wrong |
| `flashcard` | Reveals the answer, then rates whether they remembered it. | Remembered / study again |

The `limit` parameter can be 5, 10 or 20; an invalid or missing value counts as 10. If the
collection has fewer sentences, all of them are used. Each restart picks a new random set.
The flashcard self-assessment is not presented as an automatic accuracy measure. Results are
kept only for the current session; nothing is written to the backend.

## Preparing for listening

The practice type is separate from the answer mode: `reading` (Vocabulary) means the sentence
is read, and a future `listening` means it is presented as audio. Listening can then later be
combined with multiple-choice or typed answers.

For now only `reading` is available. `listening` appears in the shared option definition as
`available: false` and is shown in the UI as an upcoming feature. No audio playback, browser
TTS, microphone access or new backend endpoint has been added.

Before listening is enabled, design the sentence audio source, the playback and error states,
the replay behavior, and when the text is revealed. Flipping the availability flag alone does
not complete the feature.

## Accessibility and verification

- Icon buttons have descriptive names, form fields have associated labels, and selections use
  real shadcn radio/select controls.
- Answer feedback includes text and an icon besides color. After grading, focus moves to the
  next action. A flashcard can't be self-assessed before its answer is revealed.
- In multiple-choice answers, keys 1–4 work when the page opens or the next question appears,
  without first focusing an answer button. The listener only grades the active question; it
  does not interfere with text fields, open menus/dialogs, IME, held-key repeats or
  Ctrl/Alt/Meta shortcuts.
- Check commands: `npm test -w frontend`, `npm run build -w frontend`,
  `npm run check -w frontend`, `npm run typecheck -w frontend`.

## In-sentence answer field

For typed answers, a shadcn `Input` appears in place of the missing word and is linked to the
single action button below through the HTML `form` attribute. The input width follows what the
learner has typed, not the length of the correct answer, so the answer length is not revealed
in advance. Very long input scrolls inside the field.

The `cloze-input`, `cloze-blank` and `cloze-answer` styles share the same text alignment and
compact look. An unanswered blank is one continuous line; underscore characters are not used.
After checking, the result is shown in the sentence with color and a short text with an icon.
For a wrong answer, the correct word takes its place in the sentence and the learner's answer
is kept on a short line. No separate result card is created.

The same button reads `Check answer` first, then `Next sentence` or `Finish session`. Enter
triggers both steps; during IME composition Enter doesn't submit the answer. On a new question,
focus moves back to the answer field in the sentence.

## Brand assets

The navbar uses `public/brand/clozera-wordmark.png`, an optimized transparent PNG copy of the
chosen light-background logo, used with the app's current light theme. The link carries an
accessible name, and the image has explicit dimensions.

The root route (`src/routes/__root.tsx`) picks separate favicon PNG files for light and dark
browser themes with a `prefers-color-scheme` media query. The default ICO version and the root
`favicon.ico`/`favicon.png` files are kept for older clients. The browser tab theme is
independent of the app's interface theme; even when the system is in dark mode, the white
wordmark is not loaded into the current light navbar.

For the chosen design files and the current limitation of the dark wordmark, see
`design/brand/wordmark-v1/README.md`.
