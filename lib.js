/**
 * 前端純函式。刻意唔用 ES module，令 file:// 直接開都行得通，
 * 亦令 tests/load-gs.mjs 可以用同一個 vm harness 載入。
 */

/** 同 src/Lib.gs 嘅 lib_buildThumbnailUrl 必須逐字一致（有 parity test 鎖住）。 */
function ui_buildThumbnailUrl(id, size) {
  return 'https://drive.google.com/thumbnail?id=' + id + '&sz=' + size;
}

function ui_statusOf(file) {
  if (file.public === true) return 'public';
  if (file.public === null || file.public === undefined) return 'unknown';
  return file.canShare ? 'fixable' : 'locked';
}

function ui_statusLabel(status) {
  var map = {
    public: '公開',
    fixable: '未公開(可自行修改)',
    locked: '未公開(需擁有者授權)',
    unknown: '未檢查',
  };
  return map[status] || status;
}

function ui_summarize(files) {
  var out = { total: files.length, public: 0, fixable: 0, locked: 0, unknown: 0 };
  for (var i = 0; i < files.length; i++) out[ui_statusOf(files[i])]++;
  return out;
}

/** 俾 SIR 直接複製去問對方開權限嘅清單。 */
function ui_lockedListText(files) {
  var lines = [];
  for (var i = 0; i < files.length; i++) {
    if (ui_statusOf(files[i]) === 'locked') {
      lines.push(files[i].folderPath + '/' + files[i].name);
    }
  }
  return lines.join('\n');
}

function ui_excelRows(files, size) {
  var rows = [['檔名', '所屬資料夾', '縮圖直連', 'File ID', '公開狀態']];
  for (var i = 0; i < files.length; i++) {
    var f = files[i];
    rows.push([
      f.name,
      f.folderPath,
      ui_buildThumbnailUrl(f.id, size),
      f.id,
      ui_statusLabel(ui_statusOf(f)),
    ]);
  }
  return rows;
}

function ui_excelFilename(rootName, dateStr) {
  var safe = String(rootName || '').replace(/[\/:*?"<>|]/g, '').trim();
  return safe ? 'drive-images_' + safe + '_' + dateStr + '.xlsx'
              : 'drive-images_' + dateStr + '.xlsx';
}
