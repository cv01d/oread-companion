# Testing System Prompt Integration

## ✅ How to Verify Settings Are Being Applied

### Step 1: Open Browser Console
1. Open your browser (http://localhost:5173)
2. Press **F12** or Right-click → **Inspect**
3. Click the **Console** tab
4. Keep it open during testing

### Step 2: Apply a Template
1. Go to **Settings** → **Mode & Templates** tab
2. Select **"Fantasy Tavern"** from the dropdown
3. Click **"Apply Template"**
4. You should see in console:
   ```
   ✅ Settings saved to localStorage
   💾 Saving settings to backend...
   ✅ Settings saved to backend successfully
   ```

### Step 3: Send a Chat Message
1. Go back to **Chat** page
2. Make sure you have a model selected
3. Type a message like: "Hello, who are you?"
4. Send it

### Step 4: Check Console Logs

You should see detailed logs showing:

#### Frontend Console (Browser):
```
📋 System Prompt Generated:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
**WORLD SETTING:**
A medieval fantasy world filled with magic...

**OPENING SCENE:**
You push open the heavy oak door of the Rusty Flagon...

**CHARACTER:**
Name: Elara
Age: 28
Gender: Female
Species: Human
Profession: Tavern Keeper

**Personality:**
Warm, welcoming, and perceptive...
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Mode: roleplay
Temperature: 0.8
Top P: 0.9
Max Tokens: 2048
```

#### Backend Terminal:
```
💬 Chat Request Received:
Model: llama2
Messages: 1 messages
System Prompt: **WORLD SETTING:**
A medieval fantasy world filled with magic...
Temperature: 0.8 Top P: 0.9 Max Tokens: 2048
```

### Step 5: Verify Response

The AI should respond **as Elara**, the tavern keeper:
- Should use warm, welcoming tone
- Should reference the tavern setting
- Should stay in character
- Should NOT speak for you (hard rule)

---

## 🧪 Test Different Modes

### Test Roleplay Mode
1. Settings → Mode & Templates → Select **"Companion Roleplay"**
2. Apply template
3. Chat: "Hey, how have you been?"
4. Should respond as **Alex**, the supportive friend

### Test Utility Mode
1. Settings → Mode & Templates → Select **"Expert Tutor"**
2. Apply template
3. Chat: "Explain how recursion works"
4. Should respond as a **patient tutor** with clear explanations

### Test Mode Switching with Commands
1. Apply a **Roleplay** template (e.g., Fantasy Tavern)
2. In chat, type: `/chat Explain what a tavern is in real life`
3. Should temporarily switch to **Utility mode** (explain factually)
4. Next message without `/chat` should return to **Roleplay mode** (back to Elara)

---

## 🔍 What to Look For

### ✅ System Prompt is Working If:
- AI responds **in character** for roleplay mode
- AI follows the **personality** and **vocal profile** you set
- AI respects **hard rules** (e.g., never speaks for the user)
- AI uses the **communication style** from utility mode
- **Banned words** from linguistic filters don't appear
- Temperature/topP/maxTokens affect response creativity/length

### ❌ System Prompt is NOT Working If:
- AI responds generically (ignores character)
- AI doesn't follow the narrator voice style
- Settings changes have no effect on responses
- No system prompt logs in console
- Backend terminal shows "System Prompt: None"

---

## 🎯 Quick Test Cases

### Test Case 1: Character Identity
**Template**: Fantasy Tavern
**Message**: "What's your name?"
**Expected**: "I'm Elara" or "My name is Elara, the tavern keeper"
**NOT Expected**: Generic AI response

### Test Case 2: World Setting
**Template**: Sci-Fi Explorer
**Message**: "Where are we?"
**Expected**: References "Frontier Station Epsilon", "observation deck", or space setting
**NOT Expected**: Doesn't know the setting

### Test Case 3: Vocal Profile
**Template**: Cyberpunk Hacker
**Message**: "How's it going?"
**Expected**: Street slang, tech jargon ("What's up, choom?", "All good in the Net")
**NOT Expected**: Formal or generic speech

### Test Case 4: User Persona
1. Settings → User Persona → Set your name to "Sam"
2. Settings → User Persona → Skills: "Expert programmer"
3. Apply Fantasy Tavern template
4. Chat: "I'm looking for work"
**Expected**: Elara addresses you as "Sam" and might reference your skills

### Test Case 5: Banned Words
1. Settings → User Persona → Banned Words: Add "actually"
2. Chat with any template
3. Check responses - should avoid using "actually"

### Test Case 6: Temperature Effects
1. Settings → General → Temperature: 0.1 (very focused)
2. Chat: "Tell me a story"
3. Should be deterministic, repetitive
4. Settings → General → Temperature: 1.5 (very creative)
5. Chat: "Tell me a story"
6. Should be wild, creative, unpredictable

---

## 🐛 Troubleshooting

### No Console Logs Appearing
- Make sure you're looking at the **browser console** (not terminal)
- Refresh the page
- Check if JavaScript errors are blocking execution

### System Prompt Shows as "None" in Backend
- Check if settings were saved (look for save confirmations)
- Verify template was applied (should see "Currently Applied" indicator)
- Try restarting the backend server

### AI Ignores System Prompt
- Some models (especially small ones) struggle with complex instructions
- Try a larger model (llama2:13b or higher)
- Check if the model supports system prompts
- Verify Ollama service is receiving the system message

### Settings Not Persisting
- Check localStorage in browser DevTools → Application → Local Storage
- Check backend file: `/Users/fastandcurious/apps/chat/data/settings.json`
- Verify backend server has write permissions

---

## 📊 Expected Console Output Example

**When you send a message, you should see something like this:**

```
✅ Settings saved to localStorage
💾 Saving settings to backend...
✅ Settings saved to backend successfully

📋 System Prompt Generated:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
**WORLD SETTING:**
A medieval fantasy world filled with magic, mythical creatures...

**OPENING SCENE:**
You push open the heavy oak door of the Rusty Flagon...

**NARRATOR VOICE:**
You are the Third-person limited perspective with immersive fantasy prose...

**HARD RULES (NEVER VIOLATE):**
1. Never speak/act for the User
2. Stay in character as Elara
3. Maintain medieval fantasy setting

**CHARACTER:**
Name: Elara
Age: 28
Gender: Female
Species: Human
Profession: Tavern Keeper

**Personality:**
Warm, welcoming, and perceptive. Elara has a sharp wit...

**USER INFORMATION:**
User Name: [Your name if set]

**MODE TOGGLE:**
- If the user sends the command "/chat", temporarily switch to Non-Roleplay...
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Mode: roleplay
Temperature: 0.8
Top P: 0.9
Max Tokens: 2048
```

---

## ✨ Success Criteria

Your system prompt integration is working correctly if:

1. ✅ Console shows full system prompt when sending messages
2. ✅ Backend terminal confirms receiving the system prompt
3. ✅ AI responses match the character/persona defined in settings
4. ✅ Switching templates changes AI behavior immediately
5. ✅ `/chat` and `/play` commands toggle between modes
6. ✅ User persona information affects responses
7. ✅ Temperature/topP/maxTokens visibly affect output
8. ✅ Banned words are avoided in responses

If all 8 criteria pass, your system is fully functional! 🎉
