const { MongoClient } = require('mongodb');
const express = require('express');
const fetch = require('node-fetch');
const cors = require('cors');
require('dotenv').config();

// MongoDB connection URI and client
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017';
const MONGO_DB = process.env.MONGO_DB || 'chatbotdb';
const MONGO_COLLECTION = process.env.MONGO_COLLECTION || 'messages';
let mongoClient;
let messagesCollection;

async function connectMongo() {
  if (!mongoClient) {
    mongoClient = new MongoClient(MONGO_URI, { useUnifiedTopology: true });
    await mongoClient.connect();
    const db = mongoClient.db(MONGO_DB);
    messagesCollection = db.collection(MONGO_COLLECTION);
    console.log('Connected to MongoDB');
  }
}

// Connect to MongoDB on server start
connectMongo().catch(console.error);

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// POST /api/gemini
app.post('/api/gemini', async (req, res) => {
  const { message } = req.body;
  if (!message) return res.status(400).json({ error: 'Message is required.' });

  try {
  // Use a concise prompt for all responses. Only limit response length for greetings.
  let prompt = "Give a concise, clear, and helpful answer: " + message;
  let generationConfig = undefined;
  let isGreeting = typeof message === 'string' && message.trim().length <= 5;
  if (isGreeting) {
    prompt += '\nReply in 5 words or less.';
    generationConfig = { maxOutputTokens: 10 };
  }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return res.status(500).json({ error: 'Gemini API key not set.' });

    const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=' + apiKey, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        ...(generationConfig ? { generationConfig } : {})
      })
    });
    const data = await response.json();
  console.log('Gemini API response:', JSON.stringify(data, null, 2));
  const reply = data.candidates?.[0]?.content?.parts?.[0]?.text || "Sorry, I couldn't get a response.";
  // For greetings, trim to 10 words. For all else, return full response.
  function trimToWords(text, maxWords) {
    if (!text) return '';
    const words = text.split(/\s+/);
    return words.slice(0, maxWords).join(' ') + (words.length > maxWords ? '...' : '');
  }
  const finalReply = isGreeting ? trimToWords(reply, 10) : reply;

    // Save to MongoDB
    if (messagesCollection) {
      await messagesCollection.insertOne({
        user: message,
        bot: finalReply,
        timestamp: new Date()
      });
    }

    res.json({ reply: finalReply });
  } catch (err) {
    res.status(500).json({ error: 'Error contacting Gemini API.' });
  }
});

// Endpoint to get chat history
app.get('/api/history', async (req, res) => {
  try {
    if (!messagesCollection) return res.status(500).json({ error: 'MongoDB not connected.' });
    const history = await messagesCollection.find({}).sort({ timestamp: -1 }).limit(100).toArray();
    res.json({ history });
  } catch (err) {
    res.status(500).json({ error: 'Error fetching chat history.' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

