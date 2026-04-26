# 06 — i18n & RTL

## Setup

`src/renderer/i18n/index.ts` wires up react-i18next. Locales under `locales/{ar,en}/common.json`. Default language = `ar`. Stored in `localStorage` key `pos.lang`.

```ts
i18n.on('languageChanged', (lng) => {
  document.documentElement.setAttribute('dir', lng === 'ar' ? 'rtl' : 'ltr');
  document.documentElement.setAttribute('lang', lng);
});
```

## RTL rules

- Use Tailwind **logical** properties: `ps-4` (padding-inline-start), `pe-4`, `start-0`, `end-0`, `text-start`, `text-end`, `border-s`, `border-e`. Avoid `pl-*` / `pr-*`.
- Components use `flex` with logical gap/direction; arrows/icons flip naturally because they sit after/before text via `gap`, not floats.
- Inputs for Arabic text use `dir="rtl"`, inputs for English/numbers use `dir="ltr"` regardless of UI language.

## Receipt & PDF

Arabic receipt PDFs use the Amiri font (to be dropped in `src/renderer/assets/fonts/Amiri-Regular.ttf` — see `docs/07-printing.md`). `src/main/printing/invoice-pdf.ts::findArabicFont()` resolves it at runtime.

## Adding keys

1. Add the key to both `locales/ar/common.json` and `locales/en/common.json`. A unit test (see `tests/unit/i18n.test.ts`) fails if they diverge.
2. Use `const { t } = useTranslation();` then `t('key')`.
3. For dynamic content, use ICU: `t('pos.change_due', { amount })`.

## Date and currency

- `src/renderer/lib/format.ts` wraps `date-fns` with `ar` / `enUS` locales.
- Currency defaults to ILS (`₪`); change from *Settings*.
