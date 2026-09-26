# Polaroid wall

Two pages over one Google Sheet:

- **`sender.html`** — mobile upload. A photo (taken or picked) plus an
  optional "To" name and message, posted to Apps Script.
- **`receiver.html`** — full-screen display. Pulls the photos from the Sheet
  and slides them across as polaroids, left to right, endlessly.

## How it is set up

| | |
|---|---|
| Store | Google Apps Script web app, saving images to Drive + rows to a Sheet |
| Endpoint | `endpoint` in `config.js` |
| Wall password | `green_heart`, in `PASSWORD` (Code.gs) — entered on the sender |
| Image location | Google Drive (`thumbnail` links stored in the Sheet) |
| Backend source | `Code.gs` (paste into Apps Script) |

Both pages read `config.js` for the `/exec` URL. Senders must type the wall
password, which the Apps Script checks on every write.

## Create the live Sheet + Apps Script

1. Go to [sheets.new](https://sheets.new) to make a Google Sheet.
2. In it: **Extensions > Apps Script**. Delete the placeholder `myFunction`
   and paste the whole of `Code.gs` over it. Save.
3. **Deploy > New deployment > Web app**:
   - *Execute as:* **Me**
   - *Who has access:* **Anyone**
   - Deploy, then copy the **`/exec`** URL.
4. Open `config.js` and set `endpoint` to the `/exec` URL.
5. Set the wall password in `Code.gs` → `var PASSWORD = "green_heart";`
   (change it if you like, and redeploy after).
6. Serve the folder (any static host, or just open the files locally) and try
   **sender.html** on a phone. Type `green_heart` as the password to send.

Redeploying after editing `Code.gs`: **Deploy > Manage deployments > edit >**
**Version: New version**, or the old code keeps serving.

## How a photo travels

1. Sender downscales/compresses the image to a JPEG (≤1600px, q0.75) on the
   device, base64-encodes it, and POSTs `{op, id, to, message, image, password}`
   as `text/plain` JSON (no CORS preflight, same trick as `twenty-six-main`).
   Apps Script rejects any write without the right password, and any image
   over ~4 MB.
2. Apps Script decodes the bytes, saves them to a Drive folder named
   `polaroid-wall-photos` (created in My Drive on first send), makes the file
   viewable-by-link, and appends `[id, to, message, imageUrl, created]` to the
   `photos` sheet.
3. Receiver GETs the rows, renders each as a polaroid, and slides a seamless
   loop across the screen. It re-checks every 30s for new photos.

## Security

- **Reads stay open.** Anyone with the `/exec` URL can GET every photo and
  caption — that is the point of a public wall. Nothing sensitive here.
- **Writes are gated** by the password `green_heart`, checked in `Code.gs`.
  It is a shared door-code, not encryption: anyone who knows it (or reads it
  in `Code.gs`) can post. Nothing on the endpoint can execute arbitrary code —
  it only writes a file and a row.
- **No delete.** There is deliberately no delete route; remove a photo by
  deleting its Drive file and sheet row by hand.
- **Captions render as text**, never HTML, so a message cannot run script on
  the wall.

## Privacy note

Photos are stored in Google Drive with link sharing on. Anyone with the
invitation link who can open the receiver can load them, and the Sheet holds
the unredacted captions. That is the same openness you accept by giving out
the wall link — do not put anything on it you would not share with everyone
who sees the screen.

## Turn it off

Empty `endpoint` in `config.js` and nothing is read or written.
