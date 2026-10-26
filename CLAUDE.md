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
nutrition-coaching-san-diego.html            San Diego coaching landing page (served at /nutrition-coaching-san-diego)
corporate-wellness-workshops-san-diego.html  Corporate workshops landing page (served at /corporate-wellness-workshops-san-diego)
testimonials.html     Client testimonials
contact.html          Ways to connect + next-step CTAs
apply.html            New client application form (5 questions, ~3-5 min)
intake.html           New client intake form (20+ questions, ~10-15 min)
legal.html            Terms / Privacy / Coaching Agreement / Waiver (tabbed)
blog/index.html       Blog home (served at /blog/). Lists every post.
blog/*.html           Blog posts (e.g. blog/how-to-count-macros-beginners.html → /blog/how-to-count-macros-beginners)
css/styles.css        All styling. Color palette is at the top in :root.
js/nav.js             Hamburger menu, nav shadow on scroll, active-link highlight.
js/forms.js           Pill/scale UI, plus apply + intake form submission.
js/guide-signup.js    Counting Macros Starter Guide sign-up box on blog posts (sends to Kit; the guide is delivered by Kit's confirmation email, no instant download).
js/popup.js           Starter Guide popup for first-time visitors (sends to Kit; the guide is delivered by Kit's confirmation email, no instant download).
downloads/            Free downloads (the Starter Guide PDF). Hidden from Google via netlify.toml. To update the guide, replace the PDF and keep the same file name.
images/               All site images: logo.png, jess-photo.jpg, nasm-badge.png, home-image.png.
robots.txt            Tells search engines they can crawl the site; points to the sitemap.
sitemap.xml           List of public pages for search engines. Add new public pages here.
netlify.toml          Netlify settings (image caching for 7 days, keep downloads/ out of Google).
```

## How to edit common things

- **Copy/text changes:** edit the relevant page's HTML directly.
- **Color or font tweaks:** edit the `:root` variables at the top of `css/styles.css`.
- **Add a new page:** copy an existing page (e.g. `about.html`), swap the content between `<main>` and `</main>`, update the `<title>` and `<meta name="description">`, then add a `<li><a href="newpage.html">…</a></li>` entry to the nav and footer of *every* page.
- **Email list (Kit):** the popup and blog guide sign-up both send to Kit form `10083869` (`app.kit.com/forms/10083869/subscriptions`, constants at the top of `js/popup.js` and `js/guide-signup.js`). The confirmation email and its wording are set in Kit, not here.
- **Change the form recipient or booking link:** see the constants at the top of `js/forms.js` (`FORMSPREE_ENDPOINT`, `BOOKING_URL`). The booking link is also hard-coded in the buttons and JSON-LD of the two San Diego pages and the home page JSON-LD; search for `calendar.app.google`.

- **Add a blog post:** copy an existing file in `blog/`, swap the `<article>` content, update the `<title>`, description, canonical URL and the JSON-LD block, then add a card for it to `blog/index.html` (and its `blogPost` entry in that page's JSON-LD) and a line to `sitemap.xml`. Pages in `blog/` use root paths (`/css/styles.css`, `/about.html`) because they live in a subfolder.

## Things that are duplicated across pages

The `<nav>` and `<footer>` blocks are copy-pasted into every HTML file. This is
the trade-off for having no build step. **When changing one, change all of them
to match** — search for "SHARED NAV" and "SHARED FOOTER" comments to find them.

Some facts also live in the **STRUCTURED DATA (JSON-LD)** block in the `<head>`
of index, about, services, testimonials and the two San Diego pages (prices, FAQ answers, testimonial
quotes, Jess's links). When you change prices, the FAQ or a testimonial, update
that block on the same page too.

## Workflow rule — always open a PR

Never commit directly to `main`. **At the start of every session**, before touching any files:

1. Check out `main` and pull the latest (`git checkout main && git pull`).
2. Create a new branch from `main` (e.g. `claude/fix-typo-services-page`).
3. Make all changes and commits on that branch.
4. Push and open a pull request **against `main`** (`gh pr create --base main`).

Never work on an existing branch from a previous session — always start fresh from `main`. This ensures the PR contains exactly the changes from the current task and nothing else.

Why: Netlify builds a deploy preview URL for every PR opened against `main`,
so Jess can click a link and see the change live before it ships. PRs branched
off anything other than `main` won't get a preview. The PR description should
explain in plain English what changed and why.
