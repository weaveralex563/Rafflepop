import TelegramBot from "node-telegram-bot-api";

// ✅ Your bot token from BotFather
const bot = new TelegramBot(process.env.BOT_TOKEN as string, {
  polling: true,
});

// ✅ IMPORTANT: put your Render backend URL here
const BACKEND_URL = "https://rafflepop.onrender.com"; 
// 🔁 REPLACE with your real Render URL

bot.onText(/\/start (.+)?/, async (msg) => {
  try {
    const telegramId = msg.from?.id;
    const username = msg.from?.username || `tg_${telegramId}`;

    // ✅ Send user to backend
    await fetch(`${https://rafflepop.onrender.com}/api/auth`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        telegram_id: telegramId,
        username,
      }),
    });

    // ✅ Send button to open your frontend (Vercel)
    await bot.sendMessage(msg.chat.id, "Welcome to RafflePop 🎰", {
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: "🎰 Open RafflePop",
              web_app: {
                url: "https://rafflepop.vercel.app", // 🔁 REPLACE THIS
              },
            },
          ],
        ],
      },
    });
  } catch (err) {
    console.error("BOT ERROR:", err);
  }
});
