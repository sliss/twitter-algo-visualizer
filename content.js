console.log("Content script loaded and setting up message listener");

function highlightTweet(tweetElement, strategy) {
  const colors = {
    'in_network': '#e6f3ff',
    'algorithmic': '#fff0e6',
    'rectweet': '#e6ffe6',
    'ForYouInNetwork': '#ffe6e6',
    'ForYouRecommendation': '#e6e6ff',
    // Add more strategies and colors as needed
  };

  const backgroundColor = colors[strategy] || '#ffffff';

  // Find the main container of the tweet
  const tweetContainer = tweetElement.querySelector('[data-testid="cellInnerDiv"]');
  if (tweetContainer) {
    tweetContainer.style.backgroundColor = backgroundColor;
    tweetContainer.setAttribute('data-injection-type', strategy);

    // Add a label to show the strategy
    const strategyLabel = document.createElement('div');
    strategyLabel.textContent = `Strategy: ${strategy}`;
    strategyLabel.style.cssText = `
      position: absolute;
      top: 5px;
      right: 5px;
      background-color: rgba(0, 0, 0, 0.7);
      color: white;
      padding: 2px 5px;
      border-radius: 3px;
      font-size: 12px;
      z-index: 1000;
    `;
    tweetContainer.appendChild(strategyLabel);
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("Message received in content script:", message);
  if (message.type === 'NETWORK_RESPONSE') {
    console.log("Network response received:", message.details);

    const tweets = parseTweetsFromResponse(message.details.response);
    console.log("Parsed tweets:", tweets);

    tweets.forEach(tweet => {
      const tweetElement = document.querySelector(`[data-tweet-id="${tweet.id}"]`);
      if (tweetElement) {
        highlightTweet(tweetElement, tweet.strategy);
      }
    });
  }
  if (message.type === 'INTERCEPTED_REQUEST') {
    console.log("Intercepted request:", message.details);
    // You can add additional processing here if needed
  }
  // Add this line to acknowledge receipt of the message
  sendResponse({ received: true });
  return true; // Indicates that the response will be sent asynchronously
});

function parseTweetsFromResponse(responseData) {
  console.log("Parsing tweets from response");
  const tweets = [];
  try {
    const instructions = responseData.data?.home?.home_timeline_urt?.instructions || [];

    for (const instruction of instructions) {
      if (instruction.type === "TimelineAddEntries") {
        for (const entry of instruction.entries) {
          if (entry.content && entry.content.itemContent && entry.content.itemContent.tweet_results) {
            const tweetResult = entry.content.itemContent.tweet_results.result;
            const tweetId = tweetResult.rest_id;
            const injectionType = entry.content.clientEventInfo?.details?.timelinesDetails?.injectionType || 'unknown';

            console.log("Found tweet:", { id: tweetId, strategy: injectionType, entryId: entry.entryId });
            tweets.push({
              id: tweetId,
              strategy: injectionType,
              entryId: entry.entryId
            });
          }
        }
      }
    }
  } catch (error) {
    console.error("Error parsing tweet data:", error);
    console.error("Error details:", error.message, error.stack);
  }

  console.log("Parsed tweets:", tweets);
  return tweets;
}

function applyHighlightingToExistingTweets() {
  const tweetElements = document.querySelectorAll('[data-testid="tweet"]');
  tweetElements.forEach(tweetElement => {
    const tweetId = tweetElement.getAttribute('data-tweet-id');
    if (tweetId) {
      // Here we're using a placeholder strategy. In a real scenario, you'd need to
      // determine the actual strategy for each tweet, which might require additional logic.
      highlightTweet(tweetElement, 'ForYouInNetwork');
    }
  });
}

// Add this new function to intercept fetch requests
function interceptFetch() {
  console.log("Setting up fetch interception");
  const originalFetch = window.fetch;
  window.fetch = async (...args) => {
    const [resource, config] = args;

    if (typeof resource === 'string' &&
      (resource.includes('/HomeTimeline') ||
        resource.includes('/HomeLatestTimeline') ||
        resource.includes('/graphql') && resource.includes('Home'))) {
      console.log('Intercepted potential timeline request:', resource);

      const response = await originalFetch(resource, config);
      response.clone().text().then(text => {
        console.log('Raw response:', text.substring(0, 200) + '...'); // Log first 200 characters
        try {
          const data = JSON.parse(text);
          console.log('Parsed data:', data);
          const tweets = parseTweetsFromResponse(data);
          console.log("Parsed tweets:", tweets);

          tweets.forEach(tweet => {
            const tweetElement = document.querySelector(`[data-tweet-id="${tweet.id}"]`);
            if (tweetElement) {
              highlightTweet(tweetElement, tweet.strategy);
            }
          });
        } catch (error) {
          console.error('Error parsing response:', error);
        }
      }).catch(error => {
        console.error('Error reading response:', error);
      });

      return response;
    }

    return originalFetch(resource, config);
  };
}

// Modify the initialize function
(function initialize() {
  console.log("Initializing content script");
  applyHighlightingToExistingTweets();

  setTimeout(() => {
    interceptFetch();
    console.log("Fetch interception set up");

    // Periodically check for new tweets
    setInterval(checkForNewTweets, 5000);
  }, 2000);

  // Test message passing
  chrome.runtime.sendMessage({ type: "CONTENT_SCRIPT_LOADED" }, response => {
    if (chrome.runtime.lastError) {
      console.error("Error sending message:", chrome.runtime.lastError);
    } else {
      console.log("Response from background script:", response);
    }
  });
})();

// Add a MutationObserver to handle dynamically loaded tweets
const observer = new MutationObserver((mutations) => {
  mutations.forEach((mutation) => {
    if (mutation.type === 'childList') {
      mutation.addedNodes.forEach((node) => {
        if (node.nodeType === Node.ELEMENT_NODE && node.matches('[data-testid="cellInnerDiv"]')) {
          const tweetElement = node.querySelector('[data-testid="tweet"]');
          if (tweetElement) {
            const tweetId = tweetElement.getAttribute('data-tweet-id');
            if (tweetId) {
              // Again, using a placeholder strategy
              highlightTweet(tweetElement, 'ForYouInNetwork');
            }
          }
        }
      });
    }
  });
});

observer.observe(document.body, { childList: true, subtree: true });

function checkForNewTweets() {
  const tweetElements = document.querySelectorAll('[data-testid="tweet"]:not([data-injection-type])');
  tweetElements.forEach(tweetElement => {
    const tweetId = tweetElement.getAttribute('data-tweet-id');
    if (tweetId) {
      // Use a default strategy for now
      highlightTweet(tweetElement, 'unknown');
    }
  });
}