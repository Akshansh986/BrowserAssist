document.addEventListener('DOMContentLoaded', () => {
  const chatContainer = document.getElementById('chat-container');
  const userInput = document.getElementById('user-input');
  const sendButton = document.getElementById('send-button');
  
  // Store conversation history
  const conversationHistory = [
    { role: 'system', content: 'You are a helpful assistant.' }
  ];
  
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

    // Create a bot message element for the streaming response
    const botMessageDiv = document.createElement('div');
    botMessageDiv.className = 'message bot-message';
    botMessageDiv.textContent = '';
    chatContainer.appendChild(botMessageDiv);
    scrollToBottom();

    // Call ChatGPT API via local server with streaming
    fetchChatGPTResponseStreaming(message, botMessageDiv, conversationHistory);
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

  // Function to call ChatGPT API via local server (non-streaming)
  async function fetchChatGPTResponse(message, messageHistory) {
    try {
      const response = await fetch('http://localhost:8000/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'gpt-3.5-turbo',
          messages: messageHistory,
          temperature: 0.7,
          max_tokens: 1000,
          stream: false,
          password: 'Webkiosk@1'
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to get response from ChatGPT');
      }

      const data = await response.json();
      return data.choices[0].message.content;
    } catch (error) {
      console.error('Error calling ChatGPT API:', error);
      throw error;
    }
  }
  
  // Function to call ChatGPT API via local server with streaming support
  async function fetchChatGPTResponseStreaming(message, messageElement, messageHistory) {
    try {
      // Add streaming class for the blinking cursor effect
      messageElement.classList.add('streaming');
      
      const response = await fetch('http://localhost:8000/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'gpt-3.5-turbo',
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