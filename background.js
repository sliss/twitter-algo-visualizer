console.log("Background script starting...");

chrome.runtime.onInstalled.addListener(() => {
  console.log("Extension installed or updated");
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("Message received in background script:", message);
  if (message.type === "CONTENT_SCRIPT_LOADED") {
    console.log("Content script loaded message received");
    sendResponse({ status: "Background script received the message" });
  }
  return true; // Indicates that the response will be sent asynchronously
});

chrome.declarativeNetRequest.onRuleMatchedDebug.addListener((info) => {
  console.log("Rule matched:", info);

  // Forward the intercepted request to the content script
  chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
    if (tabs[0]) {
      chrome.tabs.sendMessage(tabs[0].id, {
        type: "INTERCEPTED_REQUEST",
        details: info
      });
    }
  });
});

console.log("Background script setup completed");