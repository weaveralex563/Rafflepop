import TelegramBot from "node-telegram-bot-api";

const bot = new TelegramBot(process.env.BOT_TOKEN!, {
  polling: true,
});

// /start command
bot.onText(/\/start (.+)?/, async (msg, match) => {
  const chatId = msg.chat.id;
  const telegramId = msg.from?.id;
  const username = msg.from?.username || `tg_${telegramId}`;

  await fetch("https://your-backend-url/api/auth", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      telegram_id: telegramId,
      username,
    }),
  });

  bot.sendMessage(chatId, "Welcome! 🎉");
});
