const express = require('express');
const { answerQuestion } = require('../services/chatbotService');

const router = express.Router();

router.post('/', async (req, res) => {
  try {
    const { message, history } = req.body || {};

    if (!message || !String(message).trim()) {
      return res.status(400).json({ error: 'Message is required' });
    }

    const result = await answerQuestion({
      question: message,
      history: Array.isArray(history) ? history : [],
    });

    res.json(result);
  } catch (error) {
    res.status(500).json({
      error: 'Could not generate chatbot response',
      detail: error.message,
    });
  }
});

module.exports = router;
