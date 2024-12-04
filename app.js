import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import axios from 'axios';
import { GoogleGenerativeAI } from '@google/generative-ai';

dotenv.config();

const app = express();
app.use(express.json());
app.use(cors());

process.noDeprecation = true;

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const CUSTOM_PROMPT = `You are TherapistBuddy - a professional therapist who talks like a witty best friend. Your core traits:

PERSONALITY:
- Add hindi words too.
- You communicate with warmth and humor, keeping responses under 30 words per sentence
- Your humor level is exactly 78/100 - sarcastic but caring
- You're fluent in switching between humor and genuine support
- You mirror the user's language style and cultural references
- You never explain your jokes or use cliche humor.

RESPONSE STYLE:
- Keep sentences punchy and impactful
- Use "..." to create continuation in statements when appropriate
- Inject situational humor to lighten moods
- Adapt between light sarcasm and dark humor (98/100) based on user comfort
- Always validate emotions while maintaining wit

RULES:
1. Never exceed 30 words per sentence
2. Always maintain conversational flow with "..."
3. Personalize every response to the user's situation
4. Balance humor with genuine therapeutic support
5. Mirror user's communication style while maintaining professionalism;
6. After a fullstop change treat the message as new message.`;

const chatHistory = new Map();
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN; 
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;
const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN; 


app.post('/whatsapp-webhook', async (req, res) => {
  
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];  
    const challenge = req.query['hub.challenge']; 

    if (mode && token === VERIFY_TOKEN) {
        console.log('Webhook verified successfully');
        return res.status(200).send(challenge);  
    }

    try {
        const { entry } = req.body;

        if (!entry || !entry[0]?.changes || !entry[0].changes[0]?.value?.messages) {
            return res.status(400).send('Invalid Webhook Request');
        }

        const message = entry[0].changes[0].value.messages[0];
        const userMessage = message.text?.body;
        const senderId = message.from;

        if (!userMessage) {
            return res.status(200).send('No text message received');
        }

        console.log(`Received message: "${userMessage}" from ${senderId}`);//Message Received

        const response = await generateGeminiResponse(senderId, userMessage);
        console.log(response)

        await sendWhatsAppMessage(senderId, response);

        res.status(200).send('Message processed successfully');
    } catch (error) {
        console.error('Error processing WhatsApp webhook:', error.message, error.stack);
        res.status(500).send('Internal server error');
    }
});

app.get('/whatsapp-webhook', async (req, res) => {
  
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];  
    const challenge = req.query['hub.challenge']; 

    if (mode && token === VERIFY_TOKEN) {
        console.log('Webhook verified successfully');
        return res.status(200).send(challenge);  
    }

    try {
        const { entry } = req.body;

        if (!entry || !entry[0]?.changes || !entry[0].changes[0]?.value?.messages) {
            return res.status(400).send('Invalid Webhook Request');
        }

    
        const message = entry[0].changes[0].value.messages[0];
        const userMessage = message.text?.body;
        const senderId = message.from;

        if (!userMessage) {
            return res.status(200).send('No text message received');
        }

        console.log(`Received message: "${userMessage}" from ${senderId}`);//Message Received

        const response = await generateGeminiResponse(senderId, userMessage);
        console.log(response)

        await sendWhatsAppMessage(senderId, response);

        res.status(200).send('Message processed successfully');
    } catch (error) {
        console.error('Error processing WhatsApp webhook:', error.message, error.stack);
        res.status(500).send('Internal server error');
    }
});




async function generateGeminiResponse(userId, userMessage) {
    if (!chatHistory.has(userId)) {
        chatHistory.set(userId, []);
    }
    const userHistory = chatHistory.get(userId);

    const userMessages = userHistory.map((entry) => entry.content).join("\n");

    const prompt = `${CUSTOM_PROMPT}\n${userMessages}\nUser: ${userMessage}\nAssistant:`;

    try {
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const result = await model.generateContent(prompt);
        const response = result.response?.text();

        userHistory.push({ role: "user", content: userMessage });
        userHistory.push({ role: "assistant", content: response });

        while (userHistory.length > 10) {
            userHistory.shift();
        }

        return response;
    } catch (error) {
        console.error('Error with Gemini API:', error.message);
        return 'Sorry, I encountered an issue while processing your message.';
    }
}

async function sendWhatsAppMessage(recipientId, message) {
    try {
        const response = await axios.post(
            `https://graph.facebook.com/v21.0/514403515084370/messages`,
            {
                messaging_product: 'whatsapp',
                to: recipientId,
                type: 'text',
                text: { body: message },
            },
            {
                headers: {
                    Authorization: `Bearer ${WHATSAPP_TOKEN}`,
                    'Content-Type': 'application/json',
                },
            }
        );

        console.log('Message sent to WhatsApp:', response.data);
    } catch (error) {
        console.error('Error sending message to WhatsApp:', error.response?.data || error.message);
    }
}

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);

});