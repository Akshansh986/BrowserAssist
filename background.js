chrome.action.onClicked.addListener((tab) => {
  chrome.sidePanel.open({ tabId: tab.id });
});

// Listen for tab changes and notify the sidebar
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    chrome.runtime.sendMessage({ 
      type: 'TAB_CHANGED', 
      tab: tab 
    });
  } catch (error) {
    console.error("Error sending tab change message:", error);
  }
});

// Listen for tab updates (when URL changes in the same tab)
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete') {
    chrome.runtime.sendMessage({ 
      type: 'TAB_UPDATED', 
      tab: tab 
    });
  }
});

// Listen for tab removal and notify the sidebar
chrome.tabs.onRemoved.addListener((tabId, removeInfo) => {
  chrome.runtime.sendMessage({
    type: 'TAB_REMOVED',
    tabId: tabId
  });
}); 