document.addEventListener('DOMContentLoaded', () => {
  const chatContainer = document.getElementById('chat-container');
  const userInput = document.getElementById('user-input');
  const sendButton = document.getElementById('send-button');

  // Load API key from storage
  let apiKey = '';
  chrome.storage.sync.get('openai_api_key', (data) => {
    if (data.openai_api_key) {
      apiKey = data.openai_api_key;
    } else {
      // If no API key is found, prompt the user to enter one
      promptForApiKey();
    }
  });

  // Function to prompt for API key
  function promptForApiKey() {
    chatContainer.innerHTML = `
      <div class="api-key-container">
        <p>Please enter your OpenAI API key to use ChatGPT:</p>
        <input type="password" id="api-key-input" placeholder="sk-...">
        <button id="save-api-key">Save</button>
      </div>
    `;

    document.getElementById('save-api-key').addEventListener('click', () => {
      const keyInput = document.getElementById('api-key-input');
      if (keyInput.value.trim().startsWith('sk-')) {
        apiKey = keyInput.value.trim();
        chrome.storage.sync.set({ 'openai_api_key': apiKey }, () => {
          chatContainer.innerHTML = '';
          addBotMessage('Hello! How can I assist you today?');
        });
      } else {
        alert('Please enter a valid OpenAI API key starting with "sk-"');
      }
    });
  }

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

    // Show typing indicator
    const typingIndicator = document.createElement('div');
    typingIndicator.className = 'typing-indicator';
    typingIndicator.innerHTML = '<span></span><span></span><span></span>';
    chatContainer.appendChild(typingIndicator);
    scrollToBottom();

    // Call ChatGPT API
    fetchChatGPTResponse(message)
      .then(response => {
        // Remove typing indicator
        chatContainer.removeChild(typingIndicator);
        // Add bot response
        addBotMessage(response);
      })
      .catch(error => {
        // Remove typing indicator
        chatContainer.removeChild(typingIndicator);
        // Show error
        addBotMessage(`Error: ${error.message}`);
      });
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

  // Function to call ChatGPT API
  async function fetchChatGPTResponse(message) {
    if (!apiKey) {
      throw new Error('API key not found. Please set your OpenAI API key.');
    }

    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: 'gpt-3.5-turbo',
          messages: [
            { role: 'system', content: 'You are a helpful assistant.' },
            { role: 'user', content: message }
          ],
          max_tokens: 1000
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'Failed to get response from ChatGPT');
      }

      const data = await response.json();
      return data.choices[0].message.content;
    } catch (error) {
      console.error('Error calling ChatGPT API:', error);
      throw error;
    }
  }

  // Add initial bot message
  if (apiKey) {
    addBotMessage('Hello! How can I assist you today?');
  }
}); 