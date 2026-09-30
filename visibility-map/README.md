# Visibility Map

A private, local-only web app that helps you decide which parts of your identity, work and life to make visible, and to whom.

It walks you through a short assessment (contexts, identity areas, a visibility matrix, context-specific questions, documentation, boundaries and your future self). Every step explains itself in plain language, separates **where you are now** from **where you want to be**, and ends with a **notes** box. It then builds:

- a **visibility map** of every area across IRL, social media, career, portfolio, friends and private
- **Show / Selectively share / Document privately / Keep private** recommendations with the reasoning behind each
- seven **strategic dimensions** (privacy preference, strategic visibility, professional visibility, social visibility, documentation need, audience control, future-building), with the formulas shown
- 3–5 **personal brand pillars**, a **content strategy** (if you choose Social media) and a **career brand** summary (if you choose Career or Networking)
- a **documentation dashboard** for logging evidence privately before you decide whether to publish it

No account, no server, no tracking. Answers are saved in your browser's `localStorage` and never leave your device unless you export them.

---

## Files

```
visibility-map/
├── index.html      ← the page (must stay at the top level)
├── styles.css      ← all styling, including dark mode and print layout
├── script.js       ← questions, scoring logic, results, dashboard, export
├── README.md       ← this file
└── assets/
    └── favicon.svg ← the browser-tab icon
```

Everything uses relative paths, so it works from any GitHub Pages address.

---

## How to publish this website

You do not need to install anything. You only need a web browser.

1. **Download the project files.** Unzip `visibility-map.zip`. You should see `index.html`, `styles.css`, `script.js`, `README.md` and an `assets` folder.
2. **Create a GitHub account.** Go to [github.com](https://github.com), click *Sign up*, and confirm your email address.
3. **Create a repository.** Once signed in, click the **+** in the top-right corner and choose **New repository**. Name it something like `visibility-map`.
4. **Make the repository public.** On the same screen, select **Public**. Then click **Create repository**.
5. **Upload the files.** On the new, empty repository page, click the link **uploading an existing file**. Drag in *the contents* of the project folder: the three files plus the `assets` folder. Scroll down and click **Commit changes**.
   - Important: `index.html` must be at the top level of the repository, not inside another folder. If you see a folder called `visibility-map` in your repository with the files inside it, delete it and upload the files themselves instead.
6. **Open Settings → Pages.** Click the **Settings** tab at the top of your repository, then **Pages** in the left-hand menu.
7. **Select the main branch.** Under *Build and deployment*, set **Source** to *Deploy from a branch*. Under **Branch**, choose `main` and `/ (root)`.
8. **Click Save.**
9. **Open your website.** Wait one or two minutes, then refresh the Pages screen. A box at the top shows your address, for example `https://your-username.github.io/visibility-map/`. Click it.

### Updating the site later

Open the file in your repository on github.com, click the pencil icon to edit (or use *Add file → Upload files* to replace it), then **Commit changes**. The live site updates within a couple of minutes.

### Removing the "How to publish" box from the live site

The footer of the site includes these instructions for your convenience. To remove them, open `script.js`, find the function `renderFooter`, and delete the lines from `'<details><summary>How to publish this website</summary>'` down to `'</ol></details>'`.

---

## Privacy

- All answers are stored in this browser's `localStorage` under the key `visibility-map:v1`.
- **Nothing is sent anywhere unless the visitor submits.** On the last step, **See my results** sends one copy of the assessment to your private Google Sheet (once you have connected it). **See results without submitting** sends nothing.
- The documentation dashboard (entries and screenshots) is never sent.
- There is no analytics or tracking. The only other external request is for two Google Fonts (Instrument Serif and DM Mono); the site works with system fonts if those are blocked.
- **Clear all data** removes everything from the browser. It does not remove an assessment that was already submitted: the site owner deletes those rows from the sheet by assessment ID.
- Answers stay on one browser on one device. To move them, use **Download full backup** and **Import a backup**.

## Connecting Google Sheets (optional)

Submissions go from the website to a Google Apps Script Web App, which writes them into a private Google Sheet. The Apps Script is **not** part of this repository and contains no passwords.

1. Follow the setup guide (Visibility Map — Google Sheets Setup Guide). The script itself is in `google-sheets-backend/Code.gs`, which sits next to this folder in the zip. Do not upload that folder to GitHub.
2. Open `script.js`. The first code in the file is a section titled `GOOGLE SHEETS CONFIGURATION`.
3. Replace `YOUR_GOOGLE_APPS_SCRIPT_WEB_APP_URL` with your Web App URL (it ends in `/exec`). Keep the quotation marks.

While the placeholder is in place, the site works normally and sends nothing.

Each assessment has an ID like `PB-20260930-K7Q2MX`. It is stored in the browser, shown on the results page, included in exports, and used as the row key in the sheet. Resubmitting with the same ID replaces the earlier rows.

## Exporting

From the Results page or **Your data** in the sidebar:

- **Download Word (.docx)**: a formatted strategy document with every answer split into *Where you are now* and *Where you want to be*, plus a notes box after each section (filled with your notes, or empty so you can write in it). Opens in Word, Google Docs and Pages.
- **Download Excel (.xlsx)**: the same in a workbook with tabs for Summary, Now vs Goal, Visibility Map, Answers, Notes, Recommendations and your Documentation Log. Opens in Excel, Google Sheets and Numbers.
- **Download results (JSON)**: assessment ID, date, strategy, scores, brand pillars, visibility map and recommendations.
- **Copy summary**: the same, as plain text.
- **Print / Save as PDF**: your browser's print dialog with a clean document layout. Choose "Save as PDF" as the destination.
- These three leave out boundaries and areas marked private, unless you tick **Include items I marked private in exports**.
- **Download full backup**: every answer, including private ones and the dashboard. This is the file **Import a backup** accepts.

## How the recommendations work

Each identity area is rated on comfort, usefulness, control, durability (would it still be fine in two years) and personal value, plus who should have access.

- **Show** needs usefulness ≥ 4, comfort ≥ 4, control ≥ 3 and durability ≥ 3.
- Useful areas that fall short on comfort, control or durability become **Selectively share**.
- Low-usefulness areas with high personal value (≥ 4) become **Document privately**.
- Your **boundaries**, choosing **Nobody** as the audience, and **Keep private** in the Future-self step always override.
- **Supports my future identity** adds one point of usefulness; **Irrelevant** removes one; **Reveal later** holds public and strategic placements back to selective.
- "Not sure" and unanswered questions count as a neutral 3 and are flagged as provisional in the results.

The dimension formulas are listed under *How these are calculated* on the results page.

## Browser support

Current versions of Chrome, Edge, Safari and Firefox on desktop and mobile. The layout is rebuilt for phones rather than shrunk.
