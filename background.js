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

# Approaches

If there is **only one** solution in the input:
- Write a single section called \`## Approach 1\` (optionally include the approach name in the heading).
- Explain the idea in simple, step-by-step language.

If there are **multiple different solutions** in the input:
- Create one section per approach, in order:
  - \`## Approach 1\` (e.g. "Brute Force")
  - \`## Approach 2\` (e.g. "HashMap")
  - \`## Approach 3\`, etc.
- For **each** approach:
  - Explain the core idea in 1-2 short paragraphs.
  - Then give a clear, numbered, step-by-step explanation.
  - Explicitly mention how this approach is different from the previous ones.

For each approach, briefly mention the time and space complexity in its own section.

⭐ **Key Insight**
[One sentence that captures the main idea of the BEST approach]

# Complexity
- Time complexity: [overall best complexity here, e.g. \`O(n)\`]
- Space complexity: [overall best complexity here]

# Code

For **each approach**, in order, output **four code blocks** in this exact order:
1. Python
2. JavaScript
3. Java
4. C++

For example, if there are two approaches:

## Approach 1 Code (Brute Force)
\`\`\`python []
# Python code for Approach 1
\`\`\`
\`\`\`javascript []
// JavaScript code for Approach 1
\`\`\`
\`\`\`java []
// Java code for Approach 1
\`\`\`
\`\`\`cpp []
// C++ code for Approach 1
\`\`\`

## Approach 2 Code (HashMap)
\`\`\`python []
# Python code for Approach 2
\`\`\`
\`\`\`javascript []
// JavaScript code for Approach 2
\`\`\`
\`\`\`java []
// Java code for Approach 2
\`\`\`
\`\`\`cpp []
// C++ code for Approach 2
\`\`\`

At the very end of the post, AFTER the usual upvote sentence, add a tiny ASCII-art style cat asking for upvotes, for example:

(\`=^.^=\`)  "If this helped, please upvote!"

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
9. Maintain proper code block structure with closing \`\`\`
10. ALWAYS end with the little ASCII cat asking politely for an upvote, right after the upvote sentence.`;

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
1. Write explanation in simple, friendly language.
2. If there is more than one solution above, you MUST create separate sections for "Approach 1", "Approach 2", etc., and explain each one step by step.
3. Even if there is only one solution above, you MUST still provide code in ALL FOUR languages: Python, JavaScript, Java, and C++.
4. For every approach, output four complete, standalone code blocks (Python, JavaScript, Java, C++) for that approach, using the \`\`\`language [] format.
5. Wrap ALL numbers in inline code.
6. Include the standard upvote request sentence, then immediately add a small ASCII-art cat asking the reader to upvote (for example \`(=^.^=)  "If this helped, please upvote!"\`).
7. Keep it concise but clear.
8. Do NOT embed code inside other functions.
9. Maintain proper code block structure.`;
  
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
