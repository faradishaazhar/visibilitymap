# Google Sheets backend (do not upload to GitHub)

`Code.gs` is the Google Apps Script that receives submissions from the Visibility Map website and writes them into your private Google Sheet.

It does not belong in your website repository. It lives inside your Google Sheet (Extensions → Apps Script).

Quick version of the setup guide:

1. Create a blank Google Sheet.
2. Extensions → Apps Script. Delete everything in the editor and paste all of `Code.gs`. Save.
3. Choose `setup` in the function dropdown, click Run, and allow the permissions.
4. Deploy → New deployment → type: Web app. Execute as: Me. Who has access: Anyone. Deploy.
5. Copy the Web app URL (ends in `/exec`) and paste it into `GOOGLE_SCRIPT_URL` at the top of the website's `script.js`.

After any later change to `Code.gs`: Deploy → Manage deployments → pencil → Version: New version → Deploy. The URL stays the same.
