const { Markup } = require('telegraf');
const { getApplications } = require('./db');
const { restoreApplications, SEND_INTERVAL_MS } = require('./restore');

const ADMIN_IDS = new Set(
  (process.env.ADMIN_IDS || '')
    .split(',')
    .map((id) => Number(id.trim()))
    .filter(Boolean)
);

// Adminlar ma'lumotlarga (passport, telefon, rasm) ega bo'lgani uchun faqat shaxsiy
// chatda ishlaydi — guruh/kanalda jim turadi, shunda ma'lumot tasodifan oshkor bo'lmaydi.
function isAdmin(ctx) {
  return ctx.from !== undefined && ADMIN_IDS.has(ctx.from.id);
}

function adminOnly(ctx, next) {
  if (ctx.chat?.type !== 'private') return undefined;
  return isAdmin(ctx) ? next() : ctx.reply('⛔ Bu buyruq faqat adminlar uchun.');
}

function adminOnlyAction(ctx, next) {
  if (ctx.chat?.type !== 'private' || !isAdmin(ctx)) {
    return ctx.answerCbQuery("⛔ Ruxsat yo'q", { show_alert: true });
  }
  return next();
}

const MAX_LISTED_IDS = 40;
function listIds(ids) {
  const shown = ids.slice(0, MAX_LISTED_IDS).map((id) => `#${id}`).join(', ');
  const rest = ids.length - MAX_LISTED_IDS;
  return rest > 0 ? `${shown} va yana ${rest} ta` : shown;
}

function summarize(result) {
  const lines = [
    result.aborted ? "⚠️ Qayta yuborish to'xtatildi." : '✅ Qayta yuborish tugadi.',
    `Yuborildi: ${result.sent}/${result.total}`,
  ];
  if (result.duplicates.length) {
    lines.push(`Aynan bir xil takroriy (o'tkazib yuborilgan): ${listIds(result.duplicates)}`);
  }
  if (result.textOnly.length) {
    lines.push(`Rasmsiz (faqat matn) yuborilganlar: ${listIds(result.textOnly)}`);
  }
  if (result.failed.length) {
    lines.push(`Yuborilmaganlar: ${listIds(result.failed)}`);
  }
  if (result.aborted) {
    lines.push(`Sabab: ${result.aborted}`, `Davom ettirish: /restore ${result.resumeFrom}`);
  }
  return lines.join('\n');
}

let restoreRunning = false;

function registerRestore(bot) {
  bot.command('restore', adminOnly, async (ctx) => {
    const groupChatId = process.env.GROUP_CHAT_ID;
    if (!groupChatId) return ctx.reply('GROUP_CHAT_ID .env faylida sozlanmagan.');
    if (restoreRunning) return ctx.reply('Qayta yuborish allaqachon davom etmoqda.');

    const fromId = Math.max(0, Number.parseInt(ctx.message.text.split(/\s+/)[1], 10) || 0);
    const total = getApplications(fromId).length;
    if (total === 0) return ctx.reply('Bazada yuboriladigan ariza topilmadi.');

    const minutes = Math.ceil((total * SEND_INTERVAL_MS) / 60000);
    return ctx.reply(
      `Bazada ${total} ta ariza bor${fromId ? ` (#${fromId} dan boshlab)` : ''}. ` +
        `Ular ${groupChatId} ga qayta yuboriladi (~${minutes} daqiqa).\n\n` +
        `⚠️ Kanalda eski xabarlar qolgan bo'lsa, ular takrorlanadi.`,
      Markup.inlineKeyboard([
        Markup.button.callback('✅ Ha, yuborish', `restore_go:${fromId}`),
        Markup.button.callback("❌ Yo'q", 'restore_cancel'),
      ])
    );
  });

  bot.action('restore_cancel', adminOnlyAction, async (ctx) => {
    await ctx.answerCbQuery();
    await ctx.editMessageReplyMarkup(undefined).catch(() => {});
    return ctx.reply('Bekor qilindi.');
  });

  bot.action(/^restore_go:(\d+)$/, adminOnlyAction, async (ctx) => {
    if (restoreRunning) {
      return ctx.answerCbQuery('Allaqachon davom etmoqda.', { show_alert: true });
    }
    // Ikki marta bosishdan himoya: bayroq await'dan oldin, sinxron o'rnatiladi.
    restoreRunning = true;

    const fromId = Number(ctx.match[1]);
    const adminChatId = ctx.chat.id;
    const groupChatId = process.env.GROUP_CHAT_ID;

    try {
      await ctx.answerCbQuery();
      await ctx.editMessageReplyMarkup(undefined).catch(() => {});
      await ctx.reply('▶️ Qayta yuborish boshlandi. Jarayon haqida shu yerga yozib boraman.');
    } catch (err) {
      restoreRunning = false;
      throw err;
    }

    // Uzoq davom etadi (Telegraf handler'i 90 soniyada uziladi va polling bloklanadi),
    // shuning uchun handler'dan tashqarida, fonda ishlaydi.
    console.log(`Qayta yuborish boshlandi (fromId=${fromId}, chat=${groupChatId}).`);
    restoreApplications({
      telegram: bot.telegram,
      chatId: groupChatId,
      botUsername: bot.botInfo?.username,
      fromId,
      onProgress: (done, total, lastId) =>
        bot.telegram
          .sendMessage(adminChatId, `🔄 ${done}/${total} yuborildi (oxirgisi: #${lastId})`)
          .catch(() => {}),
    })
      .then((result) => {
        console.log('Qayta yuborish tugadi:', JSON.stringify(result));
        return bot.telegram.sendMessage(adminChatId, summarize(result));
      })
      .catch((err) => {
        console.error('Qayta yuborishda xatolik:', err);
        return bot.telegram
          .sendMessage(adminChatId, `❌ Qayta yuborishda xatolik: ${err.message}`)
          .catch(() => {});
      })
      .finally(() => {
        restoreRunning = false;
      });
  });
}

module.exports = { adminOnly, registerRestore, hasAdmins: ADMIN_IDS.size > 0 };
