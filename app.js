/** 全域狀態。size 改變只需要重新渲染，唔使再叫 API。 */
var state = { files: [], rootName: '', size: 'w1000' };

var $ = function (id) { return document.getElementById(id); };

function setStatus(msg) { $('status').textContent = msg || ''; }
function setNote(msg) { $('note').textContent = msg || ''; }

function setBusy(busy) {
  $('extractBtn').disabled = busy;
  $('folderInput').disabled = busy;
}

/** 叫後端列檔。GET + query 參數，Apps Script 對 GET 有 CORS 開放。 */
function fetchList(folderInput) {
  var url = CONFIG.API_URL
    + '?action=list&folderId=' + encodeURIComponent(folderInput)
    + '&token=' + encodeURIComponent(CONFIG.TOKEN);
  return fetch(url).then(function (r) { return r.json(); });
}

function extract() {
  var raw = $('folderInput').value.trim();
  if (!raw) { setStatus('請先貼資料夾連結。'); return; }

  setBusy(true);
  setNote('');
  setStatus('列檔中，同時實測公開狀態⋯⋯（相多會慢啲）');

  fetchList(raw)
    .then(function (data) {
      if (!data.ok) { setStatus('❌ ' + data.error); clearResults(); return; }
      state.files = data.files;
      state.rootName = data.rootName;
      setStatus('✅ ' + data.rootName + '：搵到 ' + data.files.length + ' 張相');
      setNote(data.note);
      renderAll();
    })
    .catch(function (err) {
      setStatus('❌ 連唔到後端：' + err.message + '（檢查 config.js 嘅 API_URL，同埋 Web App 有冇部署成「任何人」可存取）');
      clearResults();
    })
    .finally(function () { setBusy(false); });
}

function clearResults() {
  state.files = [];
  state.rootName = '';
  renderAll();
}

function renderAll() {
  renderSummary();
  renderTable();
}

function renderSummary() {
  var s = ui_summarize(state.files);
  $('summaryBar').hidden = s.total === 0;
  $('summaryText').textContent =
    '共 ' + s.total + ' 張　✅ 公開 ' + s.public
    + '　⚠️ 可自行公開 ' + s.fixable
    + '　🔒 需授權 ' + s.locked
    + (s.unknown ? '　❔ 未檢查 ' + s.unknown : '');

  $('makePublicBtn').hidden = s.fixable === 0;
  $('makePublicBtn').textContent = '一鍵設為公開 (' + s.fixable + ')';
  $('copyLockedBtn').hidden = s.locked === 0;
}

function renderTable() {
  var body = $('resultBody');
  body.textContent = '';

  $('resultTable').hidden = state.files.length === 0;
  $('empty').hidden = !(state.rootName && state.files.length === 0);

  for (var i = 0; i < state.files.length; i++) {
    body.appendChild(renderRow(state.files[i]));
  }
}

function renderRow(f) {
  var status = ui_statusOf(f);
  var url = ui_buildThumbnailUrl(f.id, state.size, f.resourceKey);
  var tr = document.createElement('tr');

  // 預覽：注意呢張圖係用你（已登入）嘅身分載入，
  // 未公開嘅相一樣可能顯示到，所以預覽絕對唔可以當狀態指示。
  var tdThumb = document.createElement('td');
  tdThumb.className = 'thumb';
  var img = document.createElement('img');
  img.loading = 'lazy';
  img.alt = f.name;
  img.src = ui_buildThumbnailUrl(f.id, 'w120', f.resourceKey);
  img.onerror = function () {
    var ph = document.createElement('div');
    ph.className = 'ph';
    ph.textContent = '無預覽';
    tdThumb.replaceChild(ph, img);
  };
  tdThumb.appendChild(img);

  var tdName = document.createElement('td');
  tdName.textContent = f.name;

  var tdFolder = document.createElement('td');
  tdFolder.textContent = f.folderPath;

  var tdLink = document.createElement('td');
  tdLink.className = 'link';
  var span = document.createElement('span');
  span.className = 'url';
  span.textContent = url;
  var copyBtn = document.createElement('button');
  copyBtn.type = 'button';
  copyBtn.textContent = '複製';
  copyBtn.onclick = function () { copyText(url, copyBtn); };
  tdLink.appendChild(span);
  tdLink.appendChild(copyBtn);

  var tdId = document.createElement('td');
  tdId.className = 'id';
  tdId.textContent = f.id;

  var tdStatus = document.createElement('td');
  var badge = document.createElement('span');
  badge.className = 'badge ' + status;
  badge.textContent = ui_statusLabel(status);
  tdStatus.appendChild(badge);

  tr.appendChild(tdThumb);
  tr.appendChild(tdName);
  tr.appendChild(tdFolder);
  tr.appendChild(tdLink);
  tr.appendChild(tdId);
  tr.appendChild(tdStatus);
  return tr;
}

/** navigator.clipboard 喺 file:// 下未必有，所以要有 fallback。 */
function copyText(text, btn) {
  var done = function () {
    if (!btn) return;
    var old = btn.textContent;
    btn.textContent = '已複製';
    setTimeout(function () { btn.textContent = old; }, 1200);
  };
  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(text).then(done);
    return;
  }
  var ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed';
  ta.style.opacity = '0';
  document.body.appendChild(ta);
  ta.select();
  document.execCommand('copy');
  document.body.removeChild(ta);
  done();
}

function allLinksText() {
  return state.files.map(function (f) { return ui_buildThumbnailUrl(f.id, state.size); }).join('\n');
}


/**
 * POST 去 Apps Script。
 * Content-Type 必須係 text/plain：application/json 會觸發 CORS preflight，
 * 而 Apps Script Web App 唔識答 OPTIONS，個請求會直接死。
 */
function postAction(payload) {
  return fetch(CONFIG.API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(payload),
  }).then(function (r) { return r.json(); });
}

function makePublic() {
  // 連 resourceKey 一齊傳：後端改完要重新實測，冇 key 嘅話舊檔實測一定失敗
  var items = state.files
    .filter(function (f) { return ui_statusOf(f) === 'fixable'; })
    .map(function (f) { return { id: f.id, resourceKey: f.resourceKey || '' }; });
  if (!items.length) return;

  var btn = $('makePublicBtn');
  btn.disabled = true;
  setStatus('正在設定 ' + items.length + ' 張相為公開，改完會即時重新實測⋯⋯');

  postAction({ action: 'makePublic', token: CONFIG.TOKEN, files: items })
    .then(function (data) {
      if (!data.ok) { setStatus('❌ ' + data.error); return; }

      var byId = {};
      for (var i = 0; i < data.results.length; i++) byId[data.results[i].id] = data.results[i];

      var failed = [];
      for (var j = 0; j < state.files.length; j++) {
        var f = state.files[j];
        var r = byId[f.id];
        if (!r) continue;
        f.public = r.public;               // 呢個係改完之後重新實測嘅結果
        if (!r.ok) failed.push(f.name + '：' + r.error);
      }

      renderAll();
      var okCount = data.results.filter(function (r2) { return r2.ok; }).length;
      setStatus(
        '✅ 成功公開 ' + okCount + ' / ' + data.results.length + ' 張'
        + (failed.length ? '。失敗：' + failed.join('；') : '')
      );
    })
    .catch(function (err) { setStatus('❌ 設定失敗：' + err.message); })
    .finally(function () { btn.disabled = false; });
}

function copyLocked() {
  var text = ui_lockedListText(state.files);
  if (!text) return;
  copyText(
    '以下相片未公開，麻煩你喺 Google Drive 將佢哋設成「知道連結的任何人可檢視」：\n\n' + text,
    $('copyLockedBtn')
  );
}

function todayStr() {
  var d = new Date();
  var mm = String(d.getMonth() + 1).padStart(2, '0');
  var dd = String(d.getDate()).padStart(2, '0');
  return d.getFullYear() + '-' + mm + '-' + dd;
}

function exportExcel() {
  if (!state.files.length) { setStatus('冇資料可以匯出。'); return; }

  // 匯出當下畫面嘅資料，包括啱啱一鍵公開之後嘅新狀態
  var rows = ui_excelRows(state.files, state.size);
  var ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [{ wch: 28 }, { wch: 24 }, { wch: 58 }, { wch: 36 }, { wch: 20 }];

  var wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, '圖片連結');
  XLSX.writeFile(wb, ui_excelFilename(state.rootName, todayStr()));

  setStatus('✅ 已下載 Excel（' + state.files.length + ' 行，尺寸 ' + state.size + '）');
}
document.addEventListener('DOMContentLoaded', function () {
  $('extractBtn').addEventListener('click', extract);
  $('folderInput').addEventListener('keydown', function (e) {
    if (e.key === 'Enter') extract();
  });
  $('sizeSelect').addEventListener('change', function (e) {
    state.size = e.target.value;
    renderAll();   // 改尺寸唔使重新叫 API
  });
  $('copyAllBtn').addEventListener('click', function () { copyText(allLinksText(), $('copyAllBtn')); });
  $('makePublicBtn').addEventListener('click', makePublic);
  $('copyLockedBtn').addEventListener('click', copyLocked);
  $('exportBtn').addEventListener('click', exportExcel);
});
