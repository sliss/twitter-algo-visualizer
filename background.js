console.log("Background script loaded");

browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("Message received in background:", message);
  if (message.type === "contentScriptLoaded") {
    console.log("Content script loaded on:", sender.tab.url);
  }
});

browser.webNavigation.onCompleted.addListener(function(details) {
  console.log("Navigation completed:", details.url);
}, { url: [{ hostContains: "twitter.com" }, { hostContains: "x.com" }] });

browser.webRequest.onBeforeRequest.addListener(
  function(details) {
    console.log("Request intercepted:", details.url);
    if (details.url.includes("HomeTimeline") || details.url.includes("home.json")) {
      console.log("HomeTimeline request detected");
      let filter = browser.webRequest.filterResponseData(details.requestId);
      let decoder = new TextDecoder("utf-8");
      let data = "";

      filter.ondata = event => {
        console.log("Receiving data");
        data += decoder.decode(event.data, { stream: true });
        filter.write(event.data);
      }

      filter.onstop = event => {
        console.log("Data reception complete");
        try {
          console.log("HomeTimeline response:", JSON.parse(data));
        } catch (e) {
          console.error("Error parsing JSON:", e);
          console.log("Raw data:", data);
        }
        filter.disconnect();
      }
    }
  },
  { urls: ["*://*.twitter.com/*", "*://*.x.com/*"] },
  ["blocking"]
);