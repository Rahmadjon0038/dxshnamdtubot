const CAPTION_LIMIT = 1024;
const TASHKENT_OFFSET_MS = 5 * 60 * 60 * 1000;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const v = (val) => (val ? val : '—');

function formatTashkentTime(sqliteUtc) {
  const date = new Date(`${sqliteUtc.replace(' ', 'T')}Z`);
  if (Number.isNaN(date.getTime())) return null;
  const t = new Date(date.getTime() + TASHKENT_OFFSET_MS);
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(t.getUTCDate())}.${pad(t.getUTCMonth() + 1)}.${t.getUTCFullYear()} ${pad(t.getUTCHours())}:${pad(t.getUTCMinutes())}`;
}

// createdAt faqat qayta tiklashda beriladi: asl yuborilgan vaqt yo'qolmasligi uchun.
function buildCaption(data, { username, telegramId, botUsername, createdAt }) {
  const lines = [
    `📥 Yangi ariza`,
    ``,
    `1. Talabalar turar joyiga joylashgan sana: ${v(data.joylashgan_sanasi)}`,
    `2. F.I.Sh.: ${v(data.fish)}`,
    `3. Passport seriyasi: ${v(data.passport_seriyasi)}`,
    `4. Tug'ilgan sanasi: ${v(data.tugilgan_sanasi)}`,
    `5. Jinsi: ${v(data.jinsi)}`,
    `6. Fakulteti: ${v(data.fakulteti)}`,
    `7. Guruh raqami: ${v(data.guruh_raqami)}`,
    `8. Kursi: ${v(data.kursi)}`,
    `9. Ta'lim turi: ${v(data.talim_turi)}`,
    `10. Ta'lim shakli: ${v(data.talim_shakli)}`,
    `11. Viloyat va tuman: ${v(data.viloyat_tuman)}`,
    `12. Telefon raqami: ${v(data.telefon_raqami)}`,
    `13. Ijtimoiy holati: ${v(data.ijtimoiy_holati)}`,
    `14. Xona raqami: ${v(data.xona_raqami)}`,
    `15. Tyutor F.I.Sh va telefon: ${v(data.tyutor_fish_tel)}`,
    ``,
    `👤 Telegram: ${username ? '@' + username : telegramId}`,
  ];
  const sentAt = createdAt && formatTashkentTime(createdAt);
  if (sentAt) lines.push(`🕒 Yuborilgan: ${sentAt}`);
  lines.push(``, `🤖 @${botUsername || 'DxshNamdtuBot'}`);
  return lines.join('\n');
}

// 429 (Too Many Requests) da Telegram xabarni qabul qilmagan bo'ladi, shuning uchun
// ko'rsatilgan vaqt kutib qayta urinish xavfsiz (dublikat yaratmaydi).
async function withRetry(fn, attempts = 5) {
  for (let attempt = 1; ; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const retryAfter = err?.code === 429 ? err.parameters?.retry_after : undefined;
      if (retryAfter === undefined || attempt >= attempts) throw err;
      await sleep((retryAfter + 1) * 1000);
    }
  }
}

// Ma'lumot yo'qolmasligi uchun bosqichma-bosqich zaiflashadi:
// rasm+caption -> rasm va alohida matn -> faqat matn.
// 'photo' — rasm yuborildi, 'text' — rasm yuborib bo'lmadi, faqat matn yetkazildi.
async function sendApplication(telegram, chatId, photoFileId, caption) {
  if (photoFileId) {
    if (caption.length <= CAPTION_LIMIT) {
      try {
        await withRetry(() => telegram.sendPhoto(chatId, photoFileId, { caption }));
        return 'photo';
      } catch (err) {
        console.warn("Rasm+caption yuborilmadi, boshqa usul bilan urinilmoqda:", err.message);
      }
    }
    try {
      const photoMessage = await withRetry(() => telegram.sendPhoto(chatId, photoFileId));
      await withRetry(() =>
        telegram.sendMessage(chatId, caption, {
          reply_parameters: { message_id: photoMessage.message_id },
        })
      );
      return 'photo';
    } catch (err) {
      console.warn('Rasm alohida yuborilmadi, faqat matn yuboriladi:', err.message);
    }
  }
  await withRetry(() => telegram.sendMessage(chatId, caption));
  return 'text';
}

module.exports = { buildCaption, sendApplication, sleep };
