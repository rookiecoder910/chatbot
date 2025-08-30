// Gemini-integrated chatbot logic
const chatWindow = document.getElementById('chat-window');
const chatForm = document.getElementById('chat-form');
const userInput = document.getElementById('user-input');
const clearChatBtn = document.getElementById('clear-chat');
const deleteHistoryBtn = document.getElementById('delete-history');

// State management for chat history
const CHAT_HISTORY_KEY = 'chatbot_history';
function saveHistory(history) {
  localStorage.setItem(CHAT_HISTORY_KEY, JSON.stringify(history));
}
function loadHistory() {
  try {
    return JSON.parse(localStorage.getItem(CHAT_HISTORY_KEY)) || [];
  } catch {
    return [];
  }
}
function clearHistory() {
  localStorage.removeItem(CHAT_HISTORY_KEY);
}

let chatHistory = loadHistory();

function appendMessage(sender, message, save = true) {
  const msgDiv = document.createElement('div');
  msgDiv.className = sender === 'user'
    ? 'text-right mb-2'
    : 'text-left mb-2';
  msgDiv.innerHTML = `<span class="inline-block px-4 py-2 rounded-lg ${
    sender === 'user'
      ? 'bg-blue-500 text-white dark:bg-blue-600'
      : 'bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-100'
  }">${message}</span>`;
  chatWindow.appendChild(msgDiv);
  chatWindow.scrollTop = chatWindow.scrollHeight;
  if (save) {
    chatHistory.push({ sender, message });
    saveHistory(chatHistory);
  }
}

async function getGeminiResponse(message) {
  try {
    const res = await fetch('http://localhost:3001/api/gemini', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message })
    });
    const data = await res.json();
    if (res.ok && data.reply) {
      return data.reply;
    } else if (data.error) {
      return `Gemini error: ${data.error}${data.details ? ' - ' + JSON.stringify(data.details) : ''}`;
    } else {
      return "Sorry, I couldn't get a response from Gemini.";
    }
  } catch (err) {
    return `Sorry, there was an error contacting Gemini. (${err.message})`;
  }
}

function showWelcome(save = true) {
  appendMessage('bot', "Hello! I'm your Gemini-powered chatbot. How can I assist you today?", save);
}

function renderHistory() {
  chatWindow.innerHTML = '';
  if (chatHistory.length === 0) {
    showWelcome(false);
  } else {
    for (const msg of chatHistory) {
      appendMessage(msg.sender, msg.message, false);
    }
  }
}

window.onload = renderHistory;

// Clear chat functionality (clears UI and history)
if (clearChatBtn) {
  clearChatBtn.addEventListener('click', () => {
    chatWindow.innerHTML = '';
    chatHistory = [];
    saveHistory(chatHistory);
    showWelcome();
  });
}

// Delete all chat history (including UI and localStorage)
if (deleteHistoryBtn) {
  deleteHistoryBtn.addEventListener('click', () => {
    chatWindow.innerHTML = '';
    chatHistory = [];
    clearHistory();
    showWelcome();
  });
}

chatForm.addEventListener('submit', async function(e) {
  e.preventDefault();
  const message = userInput.value;
  appendMessage('user', message);
  userInput.value = '';
  appendMessage('bot', '<span class="italic text-gray-400 dark:text-gray-500">Thinking...</span>', false);
  const botReply = await getGeminiResponse(message);
  // Remove the 'Thinking...' message
  const lastMsg = chatWindow.lastChild;
  if (lastMsg && lastMsg.textContent.includes('Thinking...')) {
    chatWindow.removeChild(lastMsg);
  }
  appendMessage('bot', botReply);
});
