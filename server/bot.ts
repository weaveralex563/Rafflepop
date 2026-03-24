import TelegramBot from "node-telegram-bot-api";

type Message = TelegramBot.Message;

// ✅ Initialize bot
const bot = new TelegramBot(process.env.BOT_TOKEN as string, {
  polling: true,
});

const BACKEND_URL = "https://rafflepop.onrender.com";

bot.onText(/\/start/, async (msg: Message) => {
  try {
    const telegramId = msg.from?.id;
    const username = msg.from?.username || `tg_${telegramId}`;

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

    await bot.sendMessage(msg.chat.id, "Welcome to RafflePop 🎰", {
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: "🎰 Open RafflePop",
              web_app: {
                url: "https://rafflepop.vercel.app/",
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
