document.addEventListener('DOMContentLoaded', () => {
  const chatContainer = document.getElementById('chat-container');
  const userInput = document.getElementById('user-input');
  const sendButton = document.getElementById('send-button');
  const webpageCheckbox = document.getElementById('include-webpage');
  const webpageTitle = document.getElementById('webpage-title');
  
  // Store conversation history
  const conversationHistory = [
    { role: 'system', content: 'You are a helpful assistant.' }
  ];
  
  let currentWebpageInfo = {
    title: '',
    url: '',
    content: ''
  };
  
  // Get current tab information
  function updateCurrentTabInfo() {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs && tabs.length > 0) {
        const activeTab = tabs[0];
        currentWebpageInfo.title = activeTab.title || 'Current webpage';
        currentWebpageInfo.url = activeTab.url || '';
        
        // Update the checkbox label with the webpage title
        webpageTitle.textContent = `Include "${currentWebpageInfo.title}"`;
        
        // If checkbox is checked, fetch the content
        if (webpageCheckbox.checked) {
          fetchWebpageContent();
        }
      }
    });
  }
  
  // Fetch webpage content from the active tab
  function fetchWebpageContent() {
    if (!currentWebpageInfo.url) return;
    
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs && tabs.length > 0) {
        const activeTab = tabs[0];
        
        // Execute script to get the page content
        chrome.scripting.executeScript({
          target: { tabId: activeTab.id },
          function: () => {
            return document.body.innerText;
          }
        }, (results) => {
          if (results && results[0] && results[0].result) {
            currentWebpageInfo.content = results[0].result;
          }
        });
      }
    });
  }
  
  // Initialize the extension
  updateCurrentTabInfo();
  
  // Update tab info when the checkbox is clicked
  webpageCheckbox.addEventListener('change', () => {
    if (webpageCheckbox.checked) {
      updateCurrentTabInfo();
    }
  });
  
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
  function sendMessage() {
    const message = userInput.value.trim();
    if (!message) return;

    // Add user message to chat
    addUserMessage(message);
    userInput.value = '';
    
    // Add user message to conversation history
    conversationHistory.push({ role: 'user', content: message });
    
    // If checkbox is checked, add webpage context to the conversation
    if (webpageCheckbox.checked && currentWebpageInfo.content) {
      const webpageContext = {
        role: 'system',
        content: `The user is currently on the webpage titled "${currentWebpageInfo.title}" with URL ${currentWebpageInfo.url}. 
The content of the webpage is: ${currentWebpageInfo.content.substring(0, 15000)}` // Limiting content length
      };
      
      // Insert webpage context right before the user's latest message
      conversationHistory.splice(conversationHistory.length - 1, 0, webpageContext);
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
    if (webpageCheckbox.checked && currentWebpageInfo.content) {
      // Find and remove the webpage context message we added
      const contextIndex = conversationHistory.findIndex(msg => 
        msg.role === 'system' && msg.content.includes(`The user is currently on the webpage titled "${currentWebpageInfo.title}"`)
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