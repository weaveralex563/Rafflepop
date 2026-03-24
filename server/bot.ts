import TelegramBot from "node-telegram-bot-api";
import * as https from "https";

// ✅ Initialize bot
const bot = new TelegramBot(process.env.BOT_TOKEN as string, {
  polling: true,
});

// ✅ Put your backend URL here (IMPORTANT)
const BACKEND_URL = "https://rafflepop.onrender.com"; // 🔁 CHANGE THIS

bot.onText(/\/start/, async (msg) => {
  try {
    const telegramId = msg.from?.id;
    const username = msg.from?.username || `tg_${telegramId}`;

    // ✅ Correct fetch (THIS was your main error)
    await fetch(`${BACKEND_URL}/api/auth`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        telegram_id: telegramId,
        username: username,
      }),
    });

    // ✅ Send button to open your app
    await bot.sendMessage(msg.chat.id, "Welcome to RafflePop 🎰", {
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: "🎰 Open RafflePop",
              web_app: {
                url: "https://rafflepop.vercel.app/", // 🔁 CHANGE THIS
              },
            },
          ],
        ],
      },
    });
  } catch (error) {
    console.error("BOT ERROR:", error);
  }
});
