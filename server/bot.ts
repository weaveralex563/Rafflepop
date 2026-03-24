import TelegramBot from "node-telegram-bot-api";

const bot = new TelegramBot(process.env.BOT_TOKEN!, {
  polling: true,
});

bot.onText(/\/start (.+)?/, async (msg: any, match: any) => {
  const telegramId = msg.from?.id;
  const username = msg.from?.username || `tg_${telegramId}`;

  await fetch(`${process.env.BACKEND_URL}/api/auth`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      telegram_id: telegramId,
      username,
    }),
  });

  bot.sendMessage(msg.chat.id, "Welcome to RafflePop 🎰", {
  reply_markup: {
    inline_keyboard: [
      [
        {
          text: "🎰 Open RafflePop",
          web_app: {
            url: "https://rafflepop.onrender.com"
          }
        }
      ]
    ]
  }
});
}
