const fs = require('fs');
const path = require('path');
const axios = require('axios');

const README_PATH = path.join(__dirname, '..', '..', '..', 'README.md');
const MAX_HISTORY_ITEMS = 8;
const DEFAULT_SUGGESTIONS = [
  'How do claims work in KAVACH?',
  'How is the weekly premium calculated?',
  'What disruptions are covered?',
];
const TOPIC_SECTION_HINTS = {
  claims: [
    'Application Workflow & Persona Scenarios',
    'Workflow Overview',
    'Scenario A: Heavy Rain Disruption',
    'Scenario B: Platform Outage',
    'Scenario C: Curfew/Bandh',
    'Scenario D: Partial Disruption + Multi-Platform Worker',
  ],
  policy: [
    'Weekly Premium Model',
    'Coverage Tiers',
    'What the Premium Does NOT Cover',
    'Application Workflow & Persona Scenarios',
  ],
  premium: [
    'Weekly Premium Model',
    'Pricing Philosophy',
    'Premium Calculation Formula',
    'Coverage Tiers',
  ],
  triggers: [
    'Parametric Trigger Architecture',
    'Trigger Categories & Thresholds',
    'Trigger Escalation Levels',
  ],
  onboarding: [
    'Application Workflow & Persona Scenarios',
    'Workflow Overview',
  ],
};

const STOP_WORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from', 'how',
  'i', 'if', 'in', 'is', 'it', 'me', 'of', 'on', 'or', 'our', 'the', 'to',
  'what', 'when', 'where', 'which', 'who', 'why', 'with', 'you', 'your',
  'tell', 'about', 'this', 'that', 'can', 'does', 'do', 'please',
]);

let knowledgeBase = buildKnowledgeBase();

function normalizeText(value = '') {
  return value
    .replace(/\r/g, '')
    .replace(/â€”/g, ' - ')
    .replace(/â€“/g, ' - ')
    .replace(/â†’/g, ' -> ')
    .replace(/Ã—/g, ' x ')
    .replace(/â‚¹/g, 'Rs ')
    .replace(/Â/g, ' ')
    .replace(/[^\S\r\n]+/g, ' ')
    .trim();
}

function tokenize(value = '') {
  return normalizeText(value)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((token) => token && token.length > 1 && !STOP_WORDS.has(token));
}

function buildKnowledgeBase() {
  let raw = '';
  try {
    raw = fs.readFileSync(README_PATH, 'utf8');
  } catch {
    return [];
  }

  const normalized = normalizeText(raw);
  const sections = [];
  const headingRegex = /^#{1,3}\s+(.+)$/gm;
  const matches = [...normalized.matchAll(headingRegex)];

  if (!matches.length) {
    return [{
      heading: 'Project Overview',
      content: normalized.slice(0, 3000),
      tokens: tokenize(normalized.slice(0, 3000)),
    }];
  }

  matches.forEach((match, index) => {
    const heading = match[1].trim();
    const start = match.index + match[0].length;
    const end = index + 1 < matches.length ? matches[index + 1].index : normalized.length;
    const content = normalized.slice(start, end).trim();

    if (!content) return;

    sections.push({
      heading,
      content,
      tokens: tokenize(`${heading} ${content}`),
    });
  });

  return sections;
}

function scoreSection(questionTokens, section) {
  const sectionTokenSet = new Set(section.tokens);
  let score = 0;

  questionTokens.forEach((token) => {
    if (sectionTokenSet.has(token)) score += 3;
    if (section.heading.toLowerCase().includes(token)) score += 5;
  });

  const headingTerms = tokenize(section.heading);
  const headingMatches = headingTerms.filter((token) => questionTokens.includes(token)).length;
  score += headingMatches * 4;

  return score;
}

function detectTopic(question = '') {
  if (/(claim|claims|payout|paid|loss)/i.test(question)) return 'claims';
  if (/(premium|price|pricing|cost)/i.test(question)) return 'premium';
  if (/(policy|cover|coverage|tier|plan)/i.test(question)) return 'policy';
  if (/(trigger|rain|flood|aqi|curfew|outage|disruption)/i.test(question)) return 'triggers';
  if (/(register|onboard|signup|sign up|kyc)/i.test(question)) return 'onboarding';
  return null;
}

function findRelevantSections(question) {
  const questionTokens = tokenize(question);
  const topic = detectTopic(question);
  const preferredHeadings = topic ? TOPIC_SECTION_HINTS[topic] || [] : [];

  return knowledgeBase
    .map((section) => {
      let score = scoreSection(questionTokens, section);
      if (preferredHeadings.some((hint) => section.heading.includes(hint))) score += 30;
      if (/Summary: Why KAVACH Wins|Adversarial Defense|The UX Balance|500-Worker Syndicate/i.test(section.heading)) score -= 12;
      if (/Website Chatbot|Optional LLM configuration|How it answers/i.test(section.heading)) score -= 25;
      return { ...section, score };
    })
    .filter((section) => section.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
}

function isGreeting(question = '') {
  return /^(hi|hello|hey|good morning|good afternoon|good evening|namaste)\b/i.test(question.trim());
}

function isProjectQuestion(question = '') {
  return /(claim|claims|policy|premium|payout|coverage|onboarding|worker|partner|dit|digital income twin|fraud|risk|trigger|rain|aqi|flood|curfew|platform outage|kavach|how it works)/i.test(question);
}

function trimContext(sections) {
  return sections
    .map((section) => `## ${section.heading}\n${section.content.slice(0, 1600)}`)
    .join('\n\n')
    .slice(0, 4500);
}

function splitIntoSentences(content = '') {
  return normalizeText(content)
    .split(/(?<=[.!?])\s+|\n+/)
    .map((line) => line.trim())
    .filter((line) => line.length > 35)
    .filter((line) => !/^[-|`#*]+/.test(line))
    .filter((line) => !/^\d+\.\s*$/.test(line))
    .filter((line) => !line.includes('|---|'));
}

function bestSnippets(question, sections) {
  const questionTokens = tokenize(question);

  return sections
    .map((section) => {
      const candidates = splitIntoSentences(section.content)
        .map((sentence) => {
          const sentenceTokens = new Set(tokenize(sentence));
          let score = 0;
          questionTokens.forEach((token) => {
            if (sentenceTokens.has(token)) score += 3;
            if (sentence.toLowerCase().includes(token)) score += 1;
          });

          if (!/[.!?]$/.test(sentence)) score -= 2;
          return { sentence, score };
        })
        .filter((item) => item.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 2);

      return {
        heading: section.heading,
        snippets: candidates.map((item) => item.sentence),
      };
    })
    .filter((item) => item.snippets.length > 0);
}

function topicalAnswer(question) {
  const normalized = question.toLowerCase();

  if (/(claim|claims|payout|paid|loss)/i.test(normalized)) {
    return {
      answer: [
        'KAVACH claims are designed to be automated. When a disruption like heavy rain, floods, AQI spikes, curfews, or platform outages is detected, the system first confirms the event from multiple sources, then checks whether the worker could actually work during that time.',
        'After that, the Digital Income Twin estimates what the worker would normally have earned in that window, fraud checks run in the background, and the payout is calculated from the verified income loss rather than a flat amount.',
        'In the README examples, approved payouts are sent quickly to the worker through UPI after validation.',
      ].join('\n\n'),
      grounded: true,
      sources: ['Workflow Overview', 'Scenario A: Heavy Rain Disruption', 'Scenario B: Platform Outage'],
      suggestions: DEFAULT_SUGGESTIONS,
    };
  }

  if (/(policy|cover|coverage|tier|plan)/i.test(normalized)) {
    return {
      answer: [
        'KAVACH is a weekly income-protection policy for gig delivery workers. It is meant to cover verified income loss caused by external disruptions such as extreme rain, floods, AQI spikes, curfews, and even platform outages.',
        'The README describes three coverage tiers: Basic at 50%, Standard at 70%, and Premium at 85% of predicted income loss.',
        'It does not cover things like health insurance, life insurance, accidents, or vehicle repair. The product is focused specifically on lost delivery income during verified disruption windows.',
      ].join('\n\n'),
      grounded: true,
      sources: ['Coverage Tiers', 'What the Premium Does NOT Cover', 'Application Workflow & Persona Scenarios'],
      suggestions: DEFAULT_SUGGESTIONS,
    };
  }

  if (/(premium|price|pricing|cost)/i.test(normalized)) {
    return {
      answer: [
        'KAVACH uses a weekly premium model, not a monthly or annual one.',
        'According to the README, the premium is based on a base rate from the worker\'s verified weekly income, then adjusted by zone risk, seasonal risk, claims-free discount, and any surge risk loading for the coming week.',
        'So the premium changes with the worker\'s city, zone, risk profile, season, and recent claims history.',
      ].join('\n\n'),
      grounded: true,
      sources: ['Weekly Premium Model', 'Pricing Philosophy', 'Premium Calculation Formula'],
      suggestions: DEFAULT_SUGGESTIONS,
    };
  }

  if (/(trigger|rain|flood|aqi|curfew|outage|disruption)/i.test(normalized)) {
    return {
      answer: [
        'KAVACH watches for trigger events such as heavy rainfall, flash floods, AQI spikes, curfews, and platform outages.',
        'The README explains that these triggers are validated through multiple external sources before a payout flow starts, so the system is not relying on just one signal.',
        'That validation layer is important because KAVACH aims to pay only for real, confirmed disruptions.',
      ].join('\n\n'),
      grounded: true,
      sources: ['Parametric Trigger Architecture', 'Trigger Categories & Thresholds', 'Trigger Escalation Levels'],
      suggestions: DEFAULT_SUGGESTIONS,
    };
  }

  if (/(register|onboard|signup|sign up|kyc|how.*work)/i.test(normalized)) {
    return {
      answer: [
        'The onboarding flow in the README starts with registration and KYC, then risk profiling, weekly policy activation, live disruption monitoring, automated claim processing, and finally payout.',
        'The user links their phone number, identity details, platform information, work zone, and income data so KAVACH can price the policy and estimate disruption-related income loss.',
      ].join('\n\n'),
      grounded: true,
      sources: ['Application Workflow & Persona Scenarios', 'Workflow Overview'],
      suggestions: DEFAULT_SUGGESTIONS,
    };
  }

  return null;
}

function fallbackAnswer(question, sections) {
  if (isGreeting(question)) {
    return {
      answer: 'Hi, I am the KAVACH help assistant. I can explain claims, policies, premiums, payouts, onboarding, and how the platform works.',
      grounded: false,
      sources: [],
      suggestions: DEFAULT_SUGGESTIONS,
    };
  }

  if (!sections.length) {
    return {
      answer: 'I could not find a precise answer in the KAVACH knowledge file, but KAVACH is designed to protect gig delivery workers against disruptions like rain, floods, AQI spikes, curfews, and platform outages. Ask me about claims, payouts, premiums, or coverage and I will help.',
      grounded: false,
      sources: [],
      suggestions: DEFAULT_SUGGESTIONS,
    };
  }

  const topical = topicalAnswer(question);
  if (topical) return topical;

  const snippetsBySection = bestSnippets(question, sections);

  if (snippetsBySection.length) {
    const summary = snippetsBySection
      .slice(0, 2)
      .map((item) => item.snippets.join(' '))
      .join('\n\n');

    return {
      answer: `${summary}\n\nIf you want, I can also explain this in simpler terms or focus only on claims, policy, payouts, or premiums.`,
      grounded: true,
      sources: sections.map((section) => section.heading),
      suggestions: DEFAULT_SUGGESTIONS,
    };
  }

  const intro = sections[0].heading
    ? `Based on the KAVACH README section "${sections[0].heading}",`
    : 'Based on the KAVACH README,';

  const snippets = sections
    .map((section) => {
      const firstParagraph = section.content
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
        .find((line) => line.length > 40) || section.content.slice(0, 220);

      return `- ${firstParagraph.slice(0, 240).trim()}`;
    })
    .join('\n');

  return {
    answer: `${intro}\n${snippets}\n\nIf you want, I can also explain this in simpler terms or focus only on claims, policy, payouts, or premiums.`,
    grounded: true,
    sources: sections.map((section) => section.heading),
    suggestions: DEFAULT_SUGGESTIONS,
  };
}

async function generateWithLlm({ question, history, sections }) {
  const apiKey = process.env.CHATBOT_LLM_API_KEY;
  const apiUrl = process.env.CHATBOT_LLM_API_URL;
  const model = process.env.CHATBOT_LLM_MODEL;

  if (!apiKey || !apiUrl || !model) {
    return null;
  }

  const context = trimContext(sections);
  const messages = [
    {
      role: 'system',
      content: [
        'You are the KAVACH website help assistant.',
        'Answer in a crisp, friendly, support style.',
        'For KAVACH product questions, prioritize the provided README context.',
        'If the answer is not fully in the context, say what is supported by the context first, then make a careful best-effort inference without inventing backend behavior.',
        'Keep answers concise and practical.',
      ].join(' '),
    },
  ];

  if (context) {
    messages.push({
      role: 'system',
      content: `README context:\n${context}`,
    });
  }

  history.slice(-MAX_HISTORY_ITEMS).forEach((item) => {
    if (!item || !item.role || !item.content) return;
    messages.push({
      role: item.role === 'assistant' ? 'assistant' : 'user',
      content: String(item.content).slice(0, 1000),
    });
  });

  messages.push({ role: 'user', content: question });

  const response = await axios.post(
    apiUrl,
    {
      model,
      messages,
      temperature: sections.length ? 0.35 : 0.65,
    },
    {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      timeout: 15000,
    }
  );

  const answer = response.data?.choices?.[0]?.message?.content?.trim();
  if (!answer) return null;

  return {
    answer,
    grounded: sections.length > 0,
    sources: sections.map((section) => section.heading),
    suggestions: DEFAULT_SUGGESTIONS,
  };
}

async function answerQuestion({ question, history = [] }) {
  const cleanQuestion = String(question || '').trim();
  if (!cleanQuestion) {
    return {
      answer: 'Ask me anything about KAVACH claims, policy coverage, payouts, premiums, or how the platform works.',
      grounded: false,
      sources: [],
      suggestions: DEFAULT_SUGGESTIONS,
    };
  }

  knowledgeBase = knowledgeBase.length ? knowledgeBase : buildKnowledgeBase();
  const sections = isGreeting(cleanQuestion) ? [] : findRelevantSections(cleanQuestion);

  try {
    const llmAnswer = await generateWithLlm({ question: cleanQuestion, history, sections });
    if (llmAnswer) return llmAnswer;
  } catch (error) {
    console.warn('Chatbot LLM unavailable, using local fallback:', error.message);
  }

  if (!sections.length && isProjectQuestion(cleanQuestion)) {
    const overviewSections = knowledgeBase.slice(0, 2);
    return fallbackAnswer(cleanQuestion, overviewSections);
  }

  return fallbackAnswer(cleanQuestion, sections);
}

module.exports = {
  answerQuestion,
};
