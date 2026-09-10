require('dotenv').config();
const { Telegraf, Scenes, session, Markup } = require('telegraf');
const {
  upsertUser,
  getAllUserIds,
  hasApplication,
  deleteApplicationsByUser,
  sqliteSessionStore,
} = require('./db');
const { deleteRowsByTelegramId } = require('./sheets');
const applicationScene = require('./scenes/application');

const BOT_TOKEN = process.env.BOT_TOKEN;
if (!BOT_TOKEN) {
  console.error('BOT_TOKEN .env faylida topilmadi!');
  process.exit(1);
}

// salom
const bot = new Telegraf(BOT_TOKEN);
const stage = new Scenes.Stage([applicationScene]);

bot.use(session({ store: sqliteSessionStore }));
bot.use(stage.middleware());

bot.use((ctx, next) => {
  if (ctx.from) {
    upsertUser(ctx.from.id, ctx.from.username);
  }
  return next();
});

bot.start((ctx) => {
  return ctx.reply(
    "Assalomu alaykum! Bu bot orqali talaba ma'lumotlarini topshirishingiz mumkin.\n\nBoshlash uchun tugmani bosing.",
    Markup.keyboard([['📝 Ariza topshirish']]).resize()
  );
});

async function startApplication(ctx) {
  if (hasApplication(ctx.from.id)) {
    return ctx.reply(
      "⚠️ Siz oldin ariza yuborgansiz.\n\nYangi ariza yubormoqchi bo'lsangiz, avvalgi arizangiz o'chirilib, so'ng yangisini to'ldirasiz.",
      Markup.inlineKeyboard([
        Markup.button.callback("🗑 Eskisini o'chirib, yangisini yuboraman", 'confirm_new_app'),
        Markup.button.callback('Bekor qilish', 'cancel_new_app'),
      ])
    );
  }
  return ctx.scene.enter('application');
}

bot.hears('📝 Ariza topshirish', startApplication);
bot.command('ariza', startApplication);

bot.action('confirm_new_app', async (ctx) => {
  deleteApplicationsByUser(ctx.from.id);
  // Google Sheets'dan o'chirish butun jadvalni o'qib chiqadi (sekin bo'lishi
  // mumkin) — foydalanuvchini kutdirmaslik uchun fonda bajaramiz.
  deleteRowsByTelegramId(ctx.from.id).catch((err) =>
    console.error("Eski qatorlarni o'chirishda xatolik:", err)
  );
  await ctx.answerCbQuery();
  await ctx.editMessageReplyMarkup(undefined).catch(() => {});
  return ctx.scene.enter('application');
});

bot.action('cancel_new_app', async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.editMessageReplyMarkup(undefined).catch(() => {});
  return ctx.reply('Bekor qilindi.');
});

// Istalgan chatda (guruh, kanal, shaxsiy) /id buyrug'i bilan chat ID'ni bilib olish
// (faqat shu buyruqni yozgan admin ko'radi, boshqa hech kimga avtomatik chiqmaydi)
bot.command('id', (ctx) => ctx.reply(`🆔 Chat ID: ${ctx.chat.id}`));
bot.on('channel_post', (ctx) => {
  if (ctx.channelPost.text === '/id') {
    return ctx.telegram.sendMessage(ctx.chat.id, `🆔 Chat ID: ${ctx.chat.id}`);
  }
});

bot.command('cancel', (ctx) => {
  if (ctx.scene?.current) {
    ctx.scene.leave();
    return ctx.reply('Bekor qilindi.', Markup.keyboard([['📝 Ariza topshirish']]).resize());
  }
  return ctx.reply('Hozir faol jarayon yoʻq.');
});

// Adminlar uchun: barcha foydalanuvchilarga xabar yuborish
// Foydalanish: xabarga reply qilib /broadcast yozing (faqat botni ishga tushirgan admin ID lar uchun cheklash tavsiya etiladi)
bot.command('broadcast', async (ctx) => {
  const text = ctx.message.text.replace('/broadcast', '').trim();
  if (!text) {
    return ctx.reply("Foydalanish: /broadcast <xabar matni>");
  }
  const ids = getAllUserIds();
  let sent = 0;
  // Bittalab yuborish o'rniga kichik guruhlarda parallel yuboramiz — Telegram
  // reyting chegarasiga (~30 xabar/soniya) urilib qolmaslik uchun guruh
  // hajmi cheklangan va guruhlar orasida qisqa tanaffus bor, lekin ketma-ket
  // birma-bir kutishga qaraganda ancha tezroq.
  const CONCURRENCY = 20;
  const BATCH_DELAY_MS = 1000;
  for (let i = 0; i < ids.length; i += CONCURRENCY) {
    const batch = ids.slice(i, i + CONCURRENCY);
    const results = await Promise.allSettled(
      batch.map((id) => ctx.telegram.sendMessage(id, text))
    );
    sent += results.filter((r) => r.status === 'fulfilled').length;
    if (i + CONCURRENCY < ids.length) {
      await new Promise((resolve) => setTimeout(resolve, BATCH_DELAY_MS));
    }
  }
  return ctx.reply(`Xabar ${sent}/${ids.length} foydalanuvchiga yuborildi.`);
});

bot.catch((err, ctx) => {
  console.error(`Xatolik yuz berdi (${ctx.updateType}):`, err);
});

bot.launch({ dropPendingUpdates: true }, () => {
  console.log('Bot ishga tushdi.');
}).catch((err) => {
  if (err?.response?.error_code === 409) {
    console.error(
      "XATOLIK: shu BOT_TOKEN bilan boshqa bir nusxa allaqachon ishlab turibdi " +
      "(409 Conflict). Bir vaqtning o'zida faqat BITTA nusxa ishga tushirilishi kerak, " +
      "aks holda foydalanuvchilar uchun bot 'qotib qolgandek' ko'rinadi."
    );
  } else {
    console.error('Botni ishga tushirishda xatolik:', err);
  }
  process.exit(1);
});

process.on('unhandledRejection', (err) => {
  console.error('Ushlanmagan promise xatoligi:', err);
});

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
