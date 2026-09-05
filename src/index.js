require('dotenv').config();
const { Telegraf, Scenes, session, Markup } = require('telegraf');
const { upsertUser, getAllUserIds } = require('./db');
const applicationScene = require('./scenes/application');

const BOT_TOKEN = process.env.BOT_TOKEN;
if (!BOT_TOKEN) {
  console.error('BOT_TOKEN .env faylida topilmadi!');
  process.exit(1);
}

const bot = new Telegraf(BOT_TOKEN);
const stage = new Scenes.Stage([applicationScene]);

bot.use(session());
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

bot.hears('📝 Ariza topshirish', (ctx) => ctx.scene.enter('application'));
bot.command('ariza', (ctx) => ctx.scene.enter('application'));

bot.command('cancel', (ctx) => {
  if (ctx.scene?.current) {
    ctx.scene.leave();
    return ctx.reply('Bekor qilindi.', Markup.removeKeyboard());
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
  for (const id of ids) {
    try {
      await ctx.telegram.sendMessage(id, text);
      sent++;
    } catch (err) {
      // foydalanuvchi botni bloklagan bo'lishi mumkin
    }
  }
  return ctx.reply(`Xabar ${sent}/${ids.length} foydalanuvchiga yuborildi.`);
});

bot.catch((err, ctx) => {
  console.error(`Xatolik yuz berdi (${ctx.updateType}):`, err);
});

bot.launch({ dropPendingUpdates: true }, () => {
  console.log('Bot ishga tushdi.');
});

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
