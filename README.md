# ChatGPT Sidebar Chrome Extension

A Chrome extension that provides a sidebar interface to chat with ChatGPT using the OpenAI API.

## Features

- Chat with ChatGPT directly from a browser sidebar
- Persistent API key storage
- Simple and clean interface
- Works on any webpage

## Installation

1. Clone or download this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" in the top right corner
4. Click "Load unpacked" and select the folder containing this extension
5. The extension icon should now appear in your browser toolbar

## Usage

1. Click the extension icon in your browser toolbar to open the sidebar
2. Enter your OpenAI API key when prompted (you only need to do this once)
3. Start chatting with ChatGPT!

## API Key

This extension requires an OpenAI API key to function. You can get one by:

1. Creating an account at [OpenAI](https://openai.com/)
2. Navigating to the [API keys page](https://platform.openai.com/account/api-keys)
3. Creating a new API key

Your API key is stored locally in your browser using Chrome's storage API and is never sent anywhere except to OpenAI's API.

## Development

To modify this extension:

1. Edit the files as needed
2. Reload the extension in `chrome://extensions/` by clicking the refresh icon
3. Test your changes

## Files

- `manifest.json`: Extension configuration
- `background.js`: Handles opening the sidebar
- `sidebar.html`: HTML structure for the sidebar
- `sidebar.js`: JavaScript for the chat functionality
- `styles.css`: Styling for the sidebar 