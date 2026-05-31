# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

This is Jess's static marketing site. It's plain HTML/CSS/JS — no build step, no
framework, no backend. It deploys to Netlify/Vercel/Cloudflare Pages by serving
the files in this folder as-is.

## File layout

```
index.html            Home
about.html            About Jess
services.html         Coaching packages
testimonials.html     Client testimonials (currently hidden from nav)
contact.html          Ways to connect + next-step CTAs
apply.html            New client application form (5 questions, ~3-5 min)
intake.html           New client intake form (20+ questions, ~10-15 min)
legal.html            Terms / Privacy / Coaching Agreement / Waiver (tabbed)
css/styles.css        All styling. Color palette is at the top in :root.
js/nav.js             Hamburger menu, nav shadow on scroll, active-link highlight.
js/forms.js           Pill/scale UI, plus apply + intake form submission.
images/               All site images. Logo is logo.png; hero is hero-bg.jpg.
```

## How to edit common things

- **Copy/text changes:** edit the relevant page's HTML directly.
- **Color or font tweaks:** edit the `:root` variables at the top of `css/styles.css`.
- **Add a new page:** copy an existing page (e.g. `about.html`), swap the content between `<main>` and `</main>`, update the `<title>` and `<meta name="description">`, then add a `<li><a href="newpage.html">…</a></li>` entry to the nav and footer of *every* page.
- **Change the form recipient or booking link:** see the constants at the top of `js/forms.js` (`FORMSPREE_ENDPOINT`, `BOOKING_URL`).

## Things that are duplicated across pages

The `<nav>` and `<footer>` blocks are copy-pasted into every HTML file. This is
the trade-off for having no build step. **When changing one, change all of them
to match** — search for "SHARED NAV" and "SHARED FOOTER" comments to find them.

## Workflow rule — always open a PR

Never commit directly to `main`. For *any* change — even a typo fix — do this:

1. Check out `main` and pull the latest (`git checkout main && git pull`).
2. Create a new branch from `main` (e.g. `claude/fix-typo-services-page`).
3. Commit on that branch.
4. Push and open a pull request **against `main`** (`gh pr create --base main`).

Why: Netlify builds a deploy preview URL for every PR opened against `main`,
so Jess can click a link and see the change live before it ships. PRs branched
off anything other than `main` won't get a preview. The PR description should
explain in plain English what changed and why.
