# drive-image-linker（前端）

貼一條 Google Drive 資料夾連結，遞迴抽出入面所有圖片嘅檔名同可嵌入連結，逐張實測陌生人係咪真係開得到，再匯出 Excel。

呢個 repo 只放**靜態前端**，由 GitHub Pages 發佈。後端係一個獨立部署嘅 Google Apps Script Web App（唔喺呢個 repo）。

## 檔案

| 檔案 | 用途 |
|---|---|
| `index.html` | 版面 |
| `style.css` | 樣式（Minimal Mono 設計規範） |
| `lib.js` | 純函式：狀態分類、統計、Excel 列 |
| `app.js` | DOM 事件、API 呼叫、渲染 |
| `config.js` | 後端網址同存取權杖 |
| `vendor/xlsx.mini.min.js` | SheetJS 0.20.3（vendored，唔連 CDN） |

## 設定

`config.js`：

```js
var CONFIG = {
  API_URL: 'https://script.google.com/macros/s/XXXX/exec',  // Apps Script Web App 網址
  TOKEN: 'change-me',                                       // 同 Apps Script 指令碼屬性 API_TOKEN 一致
};
```

## 本機開

雙擊 `index.html` 就得——冇 build step、冇 npm 依賴、冇 CDN、唔使跑 server。
