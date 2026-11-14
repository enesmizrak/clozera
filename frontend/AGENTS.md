# Frontend Agent Instructions

- TypeScript only. Use TanStack Start file routes in `src/routes`; never edit `routeTree.gen.ts` by hand.
- Server data goes through TanStack Query (`src/data/session.ts`, `src/data/languages.ts`) or TanStack DB collections (`src/data/collections.ts`). Routes that use DB collections stay under `src/routes/_app` (`ssr: false`).
- Zustand (`src/stores/preferences.ts`) only holds per-device preferences. Shareable navigation state goes in validated search params.
- Forms use `useAppForm` from `src/components/form.tsx` with Zod schemas from `@clozera/shared`. Add API contracts and validation to `packages/shared` first.
- Use shadcn/ui components from `src/components/ui` (Base UI, `base-vega`). Add missing primitives with the official shadcn CLI and `components.json`. Base UI uses `render`, not `asChild`; style links with `buttonVariants()`.
- Use theme tokens from `src/styles.css`; `@shadcn/lint` rejects raw palette colors and unknown classes.
- Render learner-authored text with `src/components/markdown.tsx` (raw HTML disabled).
- Use named imports from `lucide-react` for icons. Import test APIs from `vite-plus/test`.
- Run `npm run typecheck`, `npm run check`, `npm test` and `npm run build` in `frontend` before completing a change.
