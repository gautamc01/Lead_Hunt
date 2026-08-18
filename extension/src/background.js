// background.js — MapsExtract Pro v3.0
// Relay messages between popup and content script

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  // Relay from content → popup: just pass through (content scripts can't
  // directly message popups in MV3 without the background relay)
  if (msg._relay === 'to_popup') {
    chrome.runtime.sendMessage({ ...msg, _relay: undefined }).catch(() => {});
  }
  return false;
});
