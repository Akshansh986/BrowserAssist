document.addEventListener('DOMContentLoaded', () => {
  const chatContainer = document.getElementById('chat-container');
  const userInput = document.getElementById('user-input');
  const sendButton = document.getElementById('send-button');
  const webpageCheckbox = document.getElementById('include-webpage');
  const webpageTitle = document.getElementById('webpage-title');
  const savedPagesContainer = document.getElementById('saved-pages-container');
  
  // Store conversation history
  const conversationHistory = [
    { role: 'system', content: 'You are a helpful assistant.' }
  ];
  
  // Current webpage info
  let currentWebpageInfo = {
    title: '',
    url: '',
    tabId: null
  };
  
  // Saved webpages array - now only storing metadata, not content
  let savedWebpages = [];
  
  // Load saved webpages from storage
  function loadSavedWebpages() {
    chrome.storage.local.get('savedWebpages', (result) => {
      if (result.savedWebpages) {
        savedWebpages = result.savedWebpages;
        renderSavedWebpages();
        checkCurrentPageStatus();
      } else {
        // Initialize empty array if nothing is saved
        savedWebpages = [];
        saveWebpagesToStorage();
      }
    });
  }
  
  // Save webpages to storage
  function saveWebpagesToStorage() {
    chrome.storage.local.set({ savedWebpages }, () => {
      console.log('Saved webpages updated:', savedWebpages.length);
    });
  }
  
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
        saveWebpagesToStorage();
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
        saveWebpagesToStorage();
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
        chrome.scripting.executeScript({
          target: { tabId: tabId },
          function: () => {
            return document.body.innerText;
          }
        }, (results) => {
          if (chrome.runtime.lastError) {
            console.error('Error fetching content:', chrome.runtime.lastError);
            resolve(''); // Tab might be closed or inaccessible
          } else if (results && results[0] && results[0].result) {
            resolve(results[0].result);
          } else {
            resolve('');
          }
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
    
    saveWebpagesToStorage();
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
          saveWebpagesToStorage();
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
      saveWebpagesToStorage();
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
  loadSavedWebpages();
  updateCurrentTabInfo();
  
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
  sendButton.addEventListener('click', sendMessage);
  userInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  // Function to send message
  async function sendMessage() {
    const message = userInput.value.trim();
    if (!message) return;

    // Add user message to chat
    addUserMessage(message);
    userInput.value = '';
    
    // Save current webpage if it's checked and not saved yet
    if (webpageCheckbox.checked && !savedWebpages.some(page => page.url === currentWebpageInfo.url)) {
      saveCurrentWebpage();
    }
    
    // Add user message to conversation history
    conversationHistory.push({ role: 'user', content: message });
    
    // Get selected webpages and fetch their content
    const selectedWebpages = savedWebpages.filter(page => page.selected);
    let contextContent = '';
    
    if (selectedWebpages.length > 0) {
      contextContent = `The user is browsing the following webpages:\n\n`;
      
      // Fetch content for all selected pages
      for (let i = 0; i < selectedWebpages.length; i++) {
        const page = selectedWebpages[i];
        let content = '';
        
        // Try to fetch content from the tab if it's still open
        if (page.tabId) {
          content = await fetchWebpageContent(page.tabId, page.url);
        }
        
        // If we couldn't get content (tab closed or error), provide a message
        if (!content) {
          content = `[Content unavailable - tab may be closed]`;
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

    // Create a bot message element for the streaming response
    const botMessageDiv = document.createElement('div');
    botMessageDiv.className = 'message bot-message';
    botMessageDiv.textContent = '';
    chatContainer.appendChild(botMessageDiv);
    scrollToBottom();

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
    messageDiv.textContent = text;
    chatContainer.appendChild(messageDiv);
    scrollToBottom();
  }

  // Function to scroll chat to bottom
  function scrollToBottom() {
    chatContainer.scrollTop = chatContainer.scrollHeight;
  }
  
  // Function to call ChatGPT API via local server with streaming support
  async function fetchChatGPTResponseStreaming(messageElement, messageHistory) {
    try {
      // Add streaming class for the blinking cursor effect
      messageElement.classList.add('streaming');
      
      const response = await fetch('http://localhost:8000/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'gpt-4.1-nano',
          messages: messageHistory,
          temperature: 0.7,
          max_tokens: 1000,
          stream: true,
          password: 'Webkiosk@1'
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to get response from ChatGPT');
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
                  messageElement.textContent = fullContent;
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
}); 