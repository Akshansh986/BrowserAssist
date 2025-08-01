document.addEventListener('DOMContentLoaded', () => {
  // Check if marked library is loaded
  if (typeof marked === 'undefined') {
    console.error('Marked library is not loaded. Some features may not work correctly.');
  } else {
    console.log('Marked library loaded successfully.');
  }

  const chatContainer = document.getElementById('chat-container');
  const userInput = document.getElementById('user-input');
  const sendButton = document.getElementById('send-button');
  const webpageCheckbox = document.getElementById('include-webpage');
  const webpageTitle = document.getElementById('webpage-title');
  const savedPagesContainer = document.getElementById('saved-pages-container');
  const clearButton = document.getElementById('clear-button');
  // Add references to API key elements
  const apiKeyInput = document.getElementById('api-key-input');
  const saveApiKeyButton = document.getElementById('save-api-key-button');
  const apiKeyStatus = document.getElementById('api-key-status');
  const changeApiKeyButton = document.getElementById('change-api-key-button');
  const apiKeySection = document.querySelector('.api-key-section');
  const mainUi = document.getElementById('main-ui');
  const themeToggle = document.getElementById('theme-toggle');
  
  // Store API key
  let openaiApiKey = '';
  
  // Load API key on startup
  loadApiKey();
  // Load theme preference on startup
  loadTheme();
  
  // Function to load API key from storage
  function loadApiKey() {
    chrome.storage.local.get(['openaiApiKey'], (result) => {
      if (result.openaiApiKey) {
        openaiApiKey = result.openaiApiKey;
        updateApiKeyStatus(true);
      } else {
        updateApiKeyStatus(false);
      }
    });
  }
  
  // Function to update API key status display
  function updateApiKeyStatus(keyExists) {
    if (apiKeyStatus) {
      if (keyExists) {
        apiKeyStatus.textContent = 'API Key: Saved';
        apiKeyStatus.classList.add('key-saved');
        apiKeyStatus.classList.remove('key-missing');
      } else {
        apiKeyStatus.textContent = 'API Key: Required';
        apiKeyStatus.classList.add('key-missing');
        apiKeyStatus.classList.remove('key-saved');
      }
    }
    // Update overall UI visibility based on key state
    updateOverallUI(keyExists);
  }
  
  // Function to show or hide main UI and API key section
  function updateOverallUI(keyExists) {
    if (keyExists) {
      if (mainUi) mainUi.style.display = 'flex';
      if (apiKeySection) apiKeySection.style.display = 'none';
      if (changeApiKeyButton) changeApiKeyButton.style.display = 'inline-block';
      if (changeApiKeyButton) changeApiKeyButton.textContent = 'Change API Key';
    } else {
      if (mainUi) mainUi.style.display = 'none';
      if (apiKeySection) apiKeySection.style.display = 'block';
      if (changeApiKeyButton) changeApiKeyButton.style.display = 'none';
    }
  }
  
  // -------- Theme (Dark / Light) Handling --------
  function applyTheme(theme) {
    if (theme === 'dark') {
      document.body.classList.add('dark-mode');
      if (themeToggle) themeToggle.textContent = '☀︎';
    } else {
      document.body.classList.remove('dark-mode');
      if (themeToggle) themeToggle.textContent = '🌙';
    }
  }

  function loadTheme() {
    chrome.storage.local.get(['theme'], (result) => {
      const storedTheme = result.theme || 'light';
      applyTheme(storedTheme);
    });
  }

  if (themeToggle) {
    themeToggle.addEventListener('click', () => {
      const isDark = document.body.classList.contains('dark-mode');
      const newTheme = isDark ? 'light' : 'dark';
      chrome.storage.local.set({ theme: newTheme }, () => {
        applyTheme(newTheme);
      });
    });
  }
  
  // Event listener for saving API key
  if (saveApiKeyButton) {
    saveApiKeyButton.addEventListener('click', () => {
      const newKey = apiKeyInput.value.trim();
      
      if (newKey) {
        // Save key to storage
        chrome.storage.local.set({ openaiApiKey: newKey }, () => {
          openaiApiKey = newKey;
          updateApiKeyStatus(true);
          apiKeyInput.value = '';
          // Hide the API key section after saving
          if (apiKeySection) apiKeySection.style.display = 'none';
        });
      } else {
        alert('Please enter a valid API key.');
      }
    });
  }
  
  // Change API key button toggles visibility of key section
  if (changeApiKeyButton) {
    changeApiKeyButton.addEventListener('click', () => {
      if (!apiKeySection) return;
      const isVisible = apiKeySection.style.display !== 'none';
      if (isVisible) {
        apiKeySection.style.display = 'none';
        changeApiKeyButton.textContent = 'Change API Key';
      } else {
        apiKeySection.style.display = 'block';
        changeApiKeyButton.textContent = 'Cancel';
      }
    });
  }
  
  // Helper function to render markdown text
  function renderMarkdown(element, text) {
    // Make sure marked is available before using it
    if (typeof marked !== 'undefined') {
      element.innerHTML = marked.parse(text);
    } else {
      // Fallback if marked isn't available
      console.warn('Marked library not available, using textContent as fallback');
      element.textContent = text;
    }
  }
  
  // Store conversation history
  const conversationHistory = [
    { role: 'system', content: 'You are an intelligent assistant integrated directly into the browser. You can help users understand web content, summarize pages, answer questions about what they are browsing, and provide relevant information based on their current browsing context.' }
  ];
  
  // Current webpage info
  let currentWebpageInfo = {
    title: '',
    url: '',
    tabId: null
  };
  
  // Saved webpages array - now only storing metadata, not content
  let savedWebpages = [];
  
  // Render saved webpages in the UI
  function renderSavedWebpages() {
    savedPagesContainer.innerHTML = '';
    
    if (savedWebpages.length === 0) {
      const emptyMessage = document.createElement('div');
      emptyMessage.className = 'empty-pages-message';
      emptyMessage.textContent = 'No saved webpages yet';
      savedPagesContainer.appendChild(emptyMessage);
      return;
    }
    
    savedWebpages.forEach((page, index) => {
      const pageItem = document.createElement('div');
      pageItem.className = 'saved-page-item';
      
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.checked = page.selected;
      checkbox.addEventListener('change', () => {
        savedWebpages[index].selected = checkbox.checked;
      });
      
      const titleSpan = document.createElement('span');
      titleSpan.className = 'saved-page-title';
      titleSpan.textContent = page.title;
      titleSpan.title = `${page.title} (${page.url})`;
      
      const removeButton = document.createElement('span');
      removeButton.className = 'remove-page';
      removeButton.textContent = '✕';
      removeButton.title = 'Remove this page';
      removeButton.addEventListener('click', (e) => {
        e.stopPropagation();
        savedWebpages.splice(index, 1);
        renderSavedWebpages();
        checkCurrentPageStatus();
      });
      
      pageItem.appendChild(checkbox);
      pageItem.appendChild(titleSpan);
      pageItem.appendChild(removeButton);
      
      savedPagesContainer.appendChild(pageItem);
    });
  }
  
  // Check if current page is already saved
  function checkCurrentPageStatus() {
    if (!currentWebpageInfo.url) return;
    
    const alreadySaved = savedWebpages.some(page => page.url === currentWebpageInfo.url);
    
    // Always enable the checkbox, even if already saved
    webpageCheckbox.disabled = false;
    
    // If already saved, check the checkbox if the saved version is selected
    if (alreadySaved) {
      const savedPage = savedWebpages.find(page => page.url === currentWebpageInfo.url);
      webpageCheckbox.checked = savedPage.selected;
      webpageTitle.textContent = `Include "${currentWebpageInfo.title}"`;
    } else {
      webpageCheckbox.checked = false;
      webpageTitle.textContent = `Include "${currentWebpageInfo.title}"`;
    }
  }
  
  // Get current tab information
  function updateCurrentTabInfo() {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs && tabs.length > 0) {
        const activeTab = tabs[0];
        
        console.log(`Active tab updated: ${activeTab.title} (ID: ${activeTab.id})`);
        
        // Update to new page info
        currentWebpageInfo.title = activeTab.title || 'Current webpage';
        currentWebpageInfo.url = activeTab.url || '';
        currentWebpageInfo.tabId = activeTab.id;
        
        // Update the checkbox label with the webpage title and check status
        checkCurrentPageStatus();
      }
    });
  }
  
  // Fetch webpage content from a tab
  async function fetchWebpageContent(tabId, url) {
    return new Promise((resolve, reject) => {
      try {
        // First check if the tab still exists
        chrome.tabs.get(tabId, (tab) => {
          if (chrome.runtime.lastError) {
            console.error('Tab no longer exists:', chrome.runtime.lastError);
            resolve('');
            return;
          }
          
          // Tab exists, try to execute script
          chrome.scripting.executeScript({
            target: { tabId: tabId },
            function: () => {
              // Try to get the whole document content including iframes
              try {
                // Get the outer HTML of the main document
                let htmlContent = "<!-- Main Document -->\n" + document.documentElement.outerHTML;
                
                // Try to get the content of all same-origin iframes
                const iframes = document.querySelectorAll('iframe');
                iframes.forEach((iframe, idx) => {
                  try {
                    let iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
                    htmlContent += `\n\n<!-- iframe[${idx}] src="${iframe.src}" -->\n` +
                                   iframeDoc.documentElement.outerHTML;
                  } catch (e) {
                    htmlContent += `\n\n<!-- iframe[${idx}] src="${iframe.src}" UNAVAILABLE: Cross-origin restriction -->\n`;
                  }
                });
                
                return {
                  success: true,
                  content: htmlContent,
                  source: 'full-page-with-iframes'
                };
              } catch (error) {
                return {
                  success: false,
                  error: error.toString()
                };
              }
            }
          }, (results) => {
            if (chrome.runtime.lastError) {
              console.error('Error fetching content:', chrome.runtime.lastError);
              resolve(''); // Tab might be inaccessible (e.g., chrome:// pages)
            } else if (results && results[0] && results[0].result) {
              const result = results[0].result;
              if (result.success) {
                console.log(`Content successfully fetched for tab ${tabId} using ${result.source}`);
                
                // Use TurndownService to convert HTML to Markdown
                const turndownService = new TurndownService();
                
                // Remove head, scripts, styles and other non-content elements
                turndownService.remove(['script', 'noscript', 'style', 'head', 'meta', 'link']);
                
                
                // // Keep only certain elements if the content is too large
                const htmlContent = result.content;                
                let markdown = turndownService.turndown(htmlContent);
                console.log(markdown)
                resolve(markdown);
              } else {
                console.error('Script execution failed:', result.error);
                resolve('');
              }
            } else {
              console.error('No results returned from executeScript');
              resolve('');
            }
          });
        });
      } catch (error) {
        console.error('Error executing script:', error);
        resolve('');
      }
    });
  }
  
  // Save current webpage (metadata only)
  function saveCurrentWebpage() {
    if (!currentWebpageInfo.url) return;
    
    // Check if webpage is already saved
    const existingIndex = savedWebpages.findIndex(page => page.url === currentWebpageInfo.url);
    
    if (existingIndex !== -1) {
      // Update existing page
      savedWebpages[existingIndex].title = currentWebpageInfo.title;
      savedWebpages[existingIndex].selected = true;
      savedWebpages[existingIndex].tabId = currentWebpageInfo.tabId;
    } else {
      // Add new webpage (metadata only)
      savedWebpages.push({
        title: currentWebpageInfo.title,
        url: currentWebpageInfo.url,
        tabId: currentWebpageInfo.tabId,
        selected: true,
        addedAt: new Date().toISOString()
      });
    }
    
    renderSavedWebpages();
  }
  
  // Handle webpage checkbox changes
  function handleWebpageCheckboxChange() {
    const isCurrentPageSaved = savedWebpages.some(page => page.url === currentWebpageInfo.url);
    
    if (webpageCheckbox.checked) {
      // Save the webpage metadata immediately
      saveCurrentWebpage();
    } else {
      // If unchecking and it's saved, update selection status
      if (isCurrentPageSaved) {
        const pageIndex = savedWebpages.findIndex(page => page.url === currentWebpageInfo.url);
        if (pageIndex !== -1) {
          savedWebpages[pageIndex].selected = false;
          renderSavedWebpages();
        }
      }
    }
  }
  
  // Handle tab removal
  function handleTabRemoval(tabId) {
    // Find and remove any saved pages associated with this tab
    const pagesToRemove = [];
    
    savedWebpages.forEach((page, index) => {
      if (page.tabId === tabId) {
        pagesToRemove.push(index);
      }
    });
    
    // Remove pages in reverse order to avoid index shifting issues
    for (let i = pagesToRemove.length - 1; i >= 0; i--) {
      savedWebpages.splice(pagesToRemove[i], 1);
    }
    
    if (pagesToRemove.length > 0) {
      renderSavedWebpages();
    }
  }
  
  // Listen for tab change messages from background script
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'TAB_CHANGED' || message.type === 'TAB_UPDATED') {
      if (message.tab) {
        console.log('Tab changed:', message.tab.title);
        updateCurrentTabInfo();
      }
    } else if (message.type === 'TAB_REMOVED') {
      console.log('Tab removed:', message.tabId);
      handleTabRemoval(message.tabId);
    }
  });
  
  // Initialize the extension
  updateCurrentTabInfo();
  renderSavedWebpages();
  
  // Update tab info when sidebar is focused
  window.addEventListener('focus', () => {
    updateCurrentTabInfo();
    console.log('Sidebar focused, updating tab info');
  });
  
  // Listen for checkbox changes
  webpageCheckbox.addEventListener('change', handleWebpageCheckboxChange);
  
  // Add initial bot message
  addBotMessage('Hello! How can I assist you today?');
  // Add the initial message to history
  conversationHistory.push({ role: 'assistant', content: 'Hello! How can I assist you today?' });

  // Event listeners
  sendButton.addEventListener('click', () => {
    console.log('Send button clicked');
    sendMessage();
  });
  userInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      console.log('Enter key pressed');
      sendMessage();
    }
  });

  // Add clear button event listener
  clearButton.addEventListener('click', () => {
    console.log('Clear button clicked');
    clearConversation();
  });
  
  // Function to send message
  async function sendMessage() {
    try {
      const message = userInput.value.trim();
      if (!message) return;

      // Add user message to chat
      addUserMessage(message);
      userInput.value = '';
      
      // Check if API key is provided
      if (!openaiApiKey) {
        const errorDiv = document.createElement('div');
        errorDiv.className = 'message bot-message';
        errorDiv.textContent = 'Please set your OpenAI API key in the API key section before sending messages.';
        chatContainer.appendChild(errorDiv);
        scrollToBottom();
        return;
      }
      
      // Save current webpage if it's checked and not saved yet
      if (webpageCheckbox.checked && !savedWebpages.some(page => page.url === currentWebpageInfo.url)) {
        saveCurrentWebpage();
      }
      
      // Add user message to conversation history
      conversationHistory.push({ role: 'user', content: message });
      
      // Create a bot message element for the streaming response
      const botMessageDiv = document.createElement('div');
      botMessageDiv.className = 'message bot-message';
      botMessageDiv.innerHTML = ''; // Use innerHTML instead of textContent
      chatContainer.appendChild(botMessageDiv);
      scrollToBottom();
      
      // Check for permissions first
      try {
        // This will prompt for permissions if needed
        await chrome.permissions.request({
          permissions: ['scripting'],
          origins: ['<all_urls>']
        });
      } catch (error) {
        console.error('Permission request failed:', error);
      }
      
      // Get selected webpages and fetch their content
      const selectedWebpages = savedWebpages.filter(page => page.selected);
      let contextContent = '';
      
      // Add current tab to the selected webpages if it's checked but not in savedWebpages
      const isCurrentPageSaved = savedWebpages.some(page => page.url === currentWebpageInfo.url);
      if (webpageCheckbox.checked && !isCurrentPageSaved && currentWebpageInfo.tabId) {
        selectedWebpages.push({
          title: currentWebpageInfo.title,
          url: currentWebpageInfo.url,
          tabId: currentWebpageInfo.tabId,
          selected: true
        });
      }
      
      if (selectedWebpages.length > 0) {
        contextContent = `The user is browsing the following webpages:\n\n`;
        
        // Fetch content for all selected pages
        for (let i = 0; i < selectedWebpages.length; i++) {
          const page = selectedWebpages[i];
          let content = '';
          
          console.log(`Attempting to fetch content for tab ${page.tabId} (${page.title})`);
          
          // Try to fetch content from the tab if it's still open
          if (page.tabId) {
            content = await fetchWebpageContent(page.tabId, page.url);
          }
          
          // If we couldn't get content (tab closed or error), provide a message
          if (!content) {
            content = `[Content unavailable - tab may be closed or is on a restricted page]`;
          }
          
          contextContent += `Page ${i + 1}: "${page.title}" (${page.url})\n`;
          contextContent += `Content: ${content.substring(0, 150000)}\n\n`;
        }
        
        // Insert webpage context right before the user's latest message
        if (contextContent) {
          const webpageContext = {
            role: 'system',
            content: contextContent
          };
          
          conversationHistory.splice(conversationHistory.length - 1, 0, webpageContext);
        }
      }

      // Call ChatGPT API via local server with streaming
      fetchChatGPTResponseStreaming(botMessageDiv, conversationHistory);
      
      // Remove the webpage context from history after sending
      if (contextContent) {
        // Find and remove the webpage context message we added
        const contextIndex = conversationHistory.findIndex(msg => 
          msg.role === 'system' && msg.content.includes('The user is browsing the following webpages:')
        );
        
        if (contextIndex !== -1) {
          conversationHistory.splice(contextIndex, 1);
        }
      }
    } catch (error) {
      console.error('Error in sendMessage:', error);
      const errorDiv = document.createElement('div');
      errorDiv.className = 'message bot-message';
      errorDiv.textContent = `Error: ${error.message}`;
      chatContainer.appendChild(errorDiv);
      scrollToBottom();
    }
  }

  // Function to add user message to chat
  function addUserMessage(text) {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message user-message';
    messageDiv.textContent = text;
    chatContainer.appendChild(messageDiv);
    scrollToBottom();
  }

  // Function to add bot message to chat
  function addBotMessage(text) {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message bot-message';
    renderMarkdown(messageDiv, text);
    chatContainer.appendChild(messageDiv);
    scrollToBottom();
  }

  // Function to scroll chat to bottom
  function scrollToBottom() {
    chatContainer.scrollTop = chatContainer.scrollHeight;
  }
  
  // Function to call ChatGPT API directly with streaming support
  async function fetchChatGPTResponseStreaming(messageElement, messageHistory) {
    try {
      // Check if API key is provided
      if (!openaiApiKey) {
        messageElement.textContent = 'Error: OpenAI API key not provided. Please set your API key to use this feature.';
        messageElement.classList.remove('streaming');
        return;
      }
      
      // Add streaming class for the blinking cursor effect
      messageElement.classList.add('streaming');
      
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${openaiApiKey}`
        },
        body: JSON.stringify({
          model: 'gpt-4.1', // Using latest available model
          messages: messageHistory,
          temperature: 0.7,
          max_tokens: 1000,
          stream: true
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to get response from OpenAI API');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let fullContent = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        // Process the chunk
        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');
        
        for (const line of lines) {
          if (line.startsWith('data:')) {
            const data = line.slice(5).trim();
            
            if (data === '[DONE]') {
              break;
            }
            
            try {
              const parsedData = JSON.parse(data);
              
              if (parsedData.choices && parsedData.choices.length > 0) {
                const choice = parsedData.choices[0];
                if (choice.delta && choice.delta.content) {
                  fullContent += choice.delta.content;
                  renderMarkdown(messageElement, fullContent);
                  scrollToBottom();
                }
              }
            } catch (e) {
              console.error('Error parsing SSE data:', e);
            }
          }
        }
      }
      
      // Add assistant response to conversation history
      conversationHistory.push({ role: 'assistant', content: fullContent });
      
      // Remove streaming class when done
      messageElement.classList.remove('streaming');
      
      return fullContent;
    } catch (error) {
      console.error('Error calling streaming ChatGPT API:', error);
      messageElement.textContent = `Error: ${error.message}`;
      // Remove streaming class in case of error
      messageElement.classList.remove('streaming');
      throw error;
    }
  }

  // Function to clear conversation
  function clearConversation() {
    try {
      // Clear chat messages from UI
      chatContainer.innerHTML = '';
      
      // Reset conversation history, keeping only the system prompt
      conversationHistory.length = 1;
      
      // Add initial bot message
      addBotMessage('Hello! How can I assist you today?');
      
      // Add the initial message to history
      conversationHistory.push({ role: 'assistant', content: 'Hello! How can I assist you today?' });
      
      // Uncheck the current webpage checkbox
      webpageCheckbox.checked = false;
      
      // Deselect all saved webpages
      savedWebpages.forEach(page => {
        page.selected = false;
      });
      
      // Re-render saved webpages to update UI
      renderSavedWebpages();
      
      console.log('Conversation cleared successfully and pages deselected');
    } catch (error) {
      console.error('Error clearing conversation:', error);
    }
  }
}); 