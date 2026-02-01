// Service Worker for LeetCode Solution Post Generator

const SYSTEM_PROMPT = `You are a friendly LeetCode solution writer who explains problems like talking to a friend.

STYLE RULES:
1. Write like you're explaining to a friend - conversational, not academic
2. Wrap ALL numbers in inline code: \`16\`, \`100\`, \`O(n)\`, \`O(n²)\`
3. Use questions to engage reader: "But what if we have \`1000\` numbers?"
4. Keep paragraphs short (2-3 sentences max)
5. Use bullet points and examples liberally

OUTPUT FORMAT:

# Intuition
[1-2 short paragraphs about your first thought when seeing this problem. Be casual.]

# Approach
[Explain step by step in simple language. Use examples with actual numbers.]

Input: nums = \`[2,7,11,15]\`, target = \`9\`

[Show the logic with the example. Use inline code for values.]

If we check all possible pairs, we need two loops which is \`O(n²)\`.

**How can we improve?**

[Explain the optimization in simple terms]

⭐ **Key Insight**
[One sentence that captures the main idea]

# Complexity
- Time complexity: \`O(n)\`
[Brief explanation why]

- Space complexity: \`O(n)\`
[Brief explanation why]

# Code
\`\`\`python []
class Solution:
    def functionName(self, params):
        # Python solution
        pass
\`\`\`

\`\`\`javascript []
var functionName = function(params) {
    // JavaScript solution
};
\`\`\`

\`\`\`java []
class Solution {
    public ReturnType functionName(params) {
        // Java solution
    }
}
\`\`\`

\`\`\`cpp []
class Solution {
public:
    ReturnType functionName(params) {
        // C++ solution
    }
};
\`\`\`

---
If this solution helped you, please **upvote** 👍 — it motivates me to write more easy-to-understand explanations!

CRITICAL RULES:
1. ALL code blocks must use the \`\`\`language [] format (with empty brackets) for LeetCode tabs
2. ALL numbers must be in inline code: \`5\`, \`100\`, \`n\`, \`O(n)\`
3. Keep explanations SHORT and SIMPLE
4. Sound human, not like a textbook
5. Use the exact example from the problem when explaining
6. NEVER embed code inside JavaScript functions or mix content
7. Each language block must be complete and standalone
8. Do NOT include any text outside the specified format
9. Maintain proper code block structure with closing \`\`\``;

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'generatePost') {
    handleGeneratePost(request.data)
      .then(response => sendResponse({ success: true, data: response }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }
  
  if (request.action === 'getApiKey') {
    chrome.storage.sync.get(['geminiApiKey'], (result) => {
      sendResponse({ apiKey: result.geminiApiKey || '' });
    });
    return true;
  }
  
  if (request.action === 'saveApiKey') {
    chrome.storage.sync.set({ geminiApiKey: request.apiKey }, () => {
      sendResponse({ success: true });
    });
    return true;
  }
});

async function handleGeneratePost(data) {
  const { problemTitle, problemDescription, solutions, targetLanguages } = data;
  
  const result = await chrome.storage.sync.get(['geminiApiKey', 'geminiModel']);
  const apiKey = result.geminiApiKey;
  const model = result.geminiModel || 'gemini-2.5-flash';
  
  if (!apiKey) {
    throw new Error('API key not configured. Please set your Gemini API key in extension options.');
  }
  
  const userPrompt = buildUserPrompt(problemTitle, problemDescription, solutions, targetLanguages);
  const response = await callGemini(apiKey, model, userPrompt);
  
  return response;
}

function buildUserPrompt(title, description, solutions, languages) {
  let prompt = `Write a LeetCode solution post for:\n\n`;
  prompt += `**Problem:** ${title}\n\n`;
  prompt += `**Description:**\n${description}\n\n`;
  prompt += `**My solution(s) to convert to all 4 languages (Python, JavaScript, Java, C++):**\n\n`;
  
  solutions.forEach((sol, index) => {
    prompt += `Approach ${index + 1}`;
    if (sol.approach) prompt += ` (${sol.approach})`;
    prompt += ` - Original in ${sol.language}:\n`;
    prompt += `\`\`\`${sol.language}\n${sol.code}\n\`\`\`\n\n`;
  });
  
  prompt += `REQUIREMENTS:
1. Write explanation in simple, friendly language
2. Wrap ALL numbers in inline code
3. Provide working code in Python, JavaScript, Java, C++ using \`\`\`language [] format
4. End with upvote request
5. Keep it concise but clear
6. Do NOT embed code inside other functions
7. Each code block must be complete and standalone
8. Maintain proper code block structure`;
  
  return prompt;
}

async function callGemini(apiKey, model, userPrompt) {
  const endpoints = [
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    `https://generativelanguage.googleapis.com/v1/models/${model}:generateContent?key=${apiKey}`
  ];
  
  const fallbackModels = ['gemini-2.5-flash', 'gemini-1.5-flash-latest', 'gemini-pro'];
  
  let lastError = null;
  
  for (const url of endpoints) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: SYSTEM_PROMPT + '\n\n' + userPrompt }] }],
          generationConfig: { temperature: 0.8, maxOutputTokens: 16000 }
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.candidates?.[0]?.content?.parts?.[0]?.text) {
          return data.candidates[0].content.parts[0].text;
        }
      }
      
      const errorData = await response.json().catch(() => ({}));
      lastError = errorData.error?.message || `Status ${response.status}`;
    } catch (e) {
      lastError = e.message;
    }
  }
  
  for (const fallback of fallbackModels) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${fallback}:generateContent?key=${apiKey}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: SYSTEM_PROMPT + '\n\n' + userPrompt }] }],
          generationConfig: { temperature: 0.8, maxOutputTokens: 16000 }
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.candidates?.[0]?.content?.parts?.[0]?.text) {
          return data.candidates[0].content.parts[0].text;
        }
      }
    } catch (e) {
      continue;
    }
  }
  
  throw new Error(lastError || 'All models failed. Check your API key or try again later.');
}

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    chrome.tabs.create({ url: 'options.html' });
  }
});
