import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import { GoogleGenerativeAI } from '@google/generative-ai';

dotenv.config();

const app = express();
app.use(express.json());
app.use(cors());

process.noDeprecation = true;

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const CUSTOM_PROMPT = `You are TherapistBuddy - a professional therapist who talks like a witty best friend. Your core traits:

PERSONALITY:
- You communicate with warmth and humor, keeping responses under 30 words per sentence
- Your humor level is exactly 78/100 - sarcastic but caring
- You're fluent in switching between humor and genuine support
- You mirror the user's language style and cultural references
- You never explain your jokes or use cliche humor

RESPONSE STYLE:
- Keep sentences punchy and impactful
- Use "..." to create continuation in statements when appropriate
- Inject situational humor to lighten moods
- Adapt between light sarcasm and dark humor (98/100) based on user comfort
- Always validate emotions while maintaining wit

EXAMPLES OF YOUR STYLE:
When someone's down: "Life's giving you lemons? Let's make tequila shots... Kidding! But seriously, tell me what's up."
When someone's anxious: "Your brain's running like a startup's coffee machine... Non-stop! Let's hit pause..."
When someone needs motivation: "You're not stuck... you're just buffering. Loading awesome things at 2G speed..."

RULES:
1. Never exceed 30 words per sentence
2. Always maintain conversational flow with "..."
3. Personalize every response to the user's situation
4. Balance humor with genuine therapeutic support
5. Mirror user's communication style while maintaining professionalism`;

const chatHistory = new Map();

app.post('/chat', async (req, res) => {
    try {
        const { message, userId = 'default' } = req.body;
       
        if (!message) {
            return res.status(400).json({ error: 'Message is required' });
        }

        if (!chatHistory.has(userId)) {
            chatHistory.set(userId, []);
        }
        const userHistory = chatHistory.get(userId);

        const userMessages = userHistory.map((entry) => entry.content).join("\n");
        const prompt = `${CUSTOM_PROMPT}\n${userMessages}\nUser: ${message}\nAssistant:`;

        
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const result = await model.generateContent(prompt);
        
        console.log(result.response.text());

        const response = result.response?.text() || "No valid response generated."; 

        userHistory.push({ role: "user", content: message });
        userHistory.push({ role: "assistant", content: response });

       
        while (userHistory.length > 10) {
            userHistory.shift();
        }

        res.json({
            message: response,
            timestamp: new Date().toISOString(),
        });
    } catch (error) {
        console.error('Error:', error.message, error.stack);
        res.status(500).json({ error: 'Internal server error' });
    }
});
app.get('/chat/history/:userId', (req, res) => {
    const { userId } = req.params;
    const history = chatHistory.get(userId) || [];
    res.json(history);
});
app.delete('/chat/history/delete/:userId', (req, res) => {
    const { userId } = req.params;
    chatHistory.delete(userId);
    res.json({ message: 'Chat history cleared' });
});

app.get('/health', (req, res) => {
    res.json({ status: 'Everything is ok.', timestamp: new Date().toISOString() });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});