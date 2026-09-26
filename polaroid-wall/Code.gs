/**
 * Backing store for the polaroid wall.
 *
 * Sender posts a compressed base64 image; this script writes the bytes to a
 * Google Drive folder and appends a row [id, to, message, imageUrl, created]
 * to a sheet named "photos". Receiver reads the rows back with GET.
 *
 * To deploy:
 *   1. Make a Google Sheet. Extensions > Apps Script.
 *   2. Replace everything in Code.gs with this file, and save.
 *   3. Deploy > New deployment > Web app.
 *        Execute as:      Me
 *        Who has access:  Anyone
 *   4. Copy the /exec URL into config.js (endpoint).
 *
 * Re-deploying after an edit needs Deploy > Manage deployments > edit >
 * Version: New version, or the old code keeps serving.
 */

var SHEET_NAME = 'photos';
var FOLDER_NAME = 'polaroid-wall-photos';
var PASSWORD = 'green_heart';        // required on every write, entered by senders
var MAX_MESSAGE = 2000;
var MAX_IMAGE64 = 4 * 1024 * 1024;   // ~4 MB of base64, protects Drive space
var MAX_ROWS = 2000;

function sheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) {
    sh = ss.insertSheet(SHEET_NAME);
    sh.appendRow(['id', 'to', 'message', 'imageUrl', 'created']);
  }
  return sh;
}

function folder_() {
  var root = DriveApp.getRootFolder();
  var it = root.getFoldersByName(FOLDER_NAME);
  if (it.hasNext()) return it.next();
  return root.createFolder(FOLDER_NAME);
}

function json_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function rowFor_(sh, id) {
  var last = sh.getLastRow();
  if (last < 2) return -1;
  var keys = sh.getRange(2, 1, last - 1, 1).getValues();
  for (var i = 0; i < keys.length; i++) {
    if (String(keys[i][0]) === String(id)) return i + 2;
  }
  return -1;
}

function doGet() {
  var sh = sheet_();
  var last = sh.getLastRow();
  var rows = [];
  if (last > 1) {
    sh.getRange(2, 1, last - 1, 5).getValues().forEach(function (r) {
      if (!r[0]) return;
      rows.push({
        id: String(r[0]),
        to: String(r[1] || ''),
        message: String(r[2] || ''),
        imageUrl: String(r[3] || ''),
        created: String(r[4] || '')
      });
    });
  }
  return json_({ rows: rows });
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
  } catch (err) {
    return json_({ ok: false, error: 'busy' });
  }

  try {
    var body = JSON.parse(e.postData.contents);

    /* Every write must carry the wall password. Reading stays open so the
       wall can load; writing asks for the shared code. */
    if (String(body.password || '') !== PASSWORD) return json_({ ok: false, error: 'bad password' });

    var id = String(body.id || '');
    if (!id || id.length > 100) return json_({ ok: false, error: 'bad id' });

    var to = String(body.to || '').slice(0, 120);
    var message = String(body.message || '').slice(0, MAX_MESSAGE);
    var image = String(body.image || '');
    if (!image) return json_({ ok: false, error: 'no image' });
    if (image.length > MAX_IMAGE64) return json_({ ok: false, error: 'image too large' });

    var imageUrl = saveImage_(image, id);

    var sh = sheet_();
    var at = rowFor_(sh, id);
    if (at > 0) {
      sh.getRange(at, 2, 1, 4).setValues([[to, message, imageUrl, new Date()]]);
    } else {
      if (sh.getLastRow() > MAX_ROWS) return json_({ ok: false, error: 'full' });
      sh.appendRow([id, to, message, imageUrl, new Date()]);
    }

    return json_({ ok: true, id: id });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

function saveImage_(imageB64, id) {
  var bytes = Utilities.base64Decode(imageB64);
  var blob = Utilities.newBlob(bytes, 'image/jpeg', id + '.jpg');
  var file = folder_().createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  /* thumbnail serves straight into an <img>, no HTML wrapper. */
  return 'https://drive.google.com/thumbnail?id=' + file.getId() + '&sz=w1600';
}
