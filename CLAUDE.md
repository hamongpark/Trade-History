@AGENTS.md

## Project notes
- Docs: `docs/01-prd.md`, `docs/02-trd.md`, `docs/03-ui.md`. UI text is Korean.
- Domain logic is pure and unit-tested in `src/lib/domain/` (`npm test`). Keep P&L/stat math there.
- All timestamps stored in UTC; trade date = ET date. Profit/buy = red, loss/sell = blue.
- Schema changes: edit `src/lib/db/schema.ts`, run `npm run db:generate`, commit `drizzle/`.
- Verify with `npm test`, `npm run lint`, `npm run typecheck`, `npm run build`.
