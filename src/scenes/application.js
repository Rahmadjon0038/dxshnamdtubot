const { Scenes, Markup } = require('telegraf');
const { saveApplication } = require('../db');
const { appendApplication } = require('../sheets');

const QUESTIONS = [
  { key: 'joylashgan_sanasi', text: '1. Joylashgan sanasi:' },
  { key: 'fish', text: '2. F.I.Sh. toʻliq:' },
  { key: 'passport_seriyasi', text: '3. Passport seriyasi:' },
  { key: 'tugilgan_sanasi', text: "4. Tug'ilgan sanasi (kun,oy,yil):" },
  { key: 'jinsi', text: '5. Jinsi:' },
  { key: 'fakulteti', text: '6. Fakulteti:' },
  { key: 'guruh_raqami', text: '7. Guruh raqami:' },
  { key: 'kursi', text: '8. Kursi (1-2-3-4):' },
  { key: 'talim_turi', text: "9. Ta'lim turi (kontrakt yoki grant):" },
  { key: 'talim_shakli', text: "10. Ta'lim shakli (kunduzgi yoki kechki):" },
  { key: 'viloyat_tuman', text: '11. Viloyati va tumani:' },
  { key: 'telefon_raqami', text: '12. Telefon raqami:' },
  {
    key: 'ijtimoiy_holati',
    text: "13. Ijtimoiy holati (temir daftar, nogironligi bor, boquvchisi yo'q, chin yetim, va boshqa):",
  },
  { key: 'xona_raqami', text: '14. Xona raqami:' },
  { key: 'tyutor_fish_tel', text: '15. Tyutor F.I.Sh va telefon raqami:' },
];

const TOTAL_STEPS = QUESTIONS.length + 1;

function cancelKeyboard() {
  return Markup.keyboard([['❌ Bekor qilish']]).resize();
}

function buildStepHandler(index) {
  return async (ctx) => {
    if (ctx.message?.text === '❌ Bekor qilish') {
      ctx.scene.leave();
      return ctx.reply('Ariza bekor qilindi.', Markup.removeKeyboard());
    }

    const prevQuestion = QUESTIONS[index - 1];
    if (!ctx.message || !ctx.message.text) {
      return ctx.reply("Iltimos, matn ko'rinishida javob bering.");
    }
    ctx.wizard.state.data[prevQuestion.key] = ctx.message.text.trim();

    if (index < QUESTIONS.length) {
      await ctx.reply(
        `${QUESTIONS[index].text}\n\n(${index + 1}/${TOTAL_STEPS})`,
        cancelKeyboard()
      );
      return ctx.wizard.next();
    }

    await ctx.reply(
      `16. 3.5x4.5 rasm yuboring (fotosurat sifatida):\n\n(${TOTAL_STEPS}/${TOTAL_STEPS})`,
      cancelKeyboard()
    );
    return ctx.wizard.next();
  };
}

const steps = [
  async (ctx) => {
    ctx.wizard.state.data = {};
    await ctx.reply(
      `Ariza topshirish boshlandi. Har bir savolga navbat bilan javob bering.\n\n${QUESTIONS[0].text}\n\n(1/${TOTAL_STEPS})`,
      cancelKeyboard()
    );
    return ctx.wizard.next();
  },
];

for (let i = 1; i <= QUESTIONS.length; i++) {
  steps.push(buildStepHandler(i));
}

steps.push(async (ctx) => {
  if (ctx.message?.text === '❌ Bekor qilish') {
    ctx.scene.leave();
    return ctx.reply('Ariza bekor qilindi.', Markup.removeKeyboard());
  }

  const photo = ctx.message?.photo;
  if (!photo || photo.length === 0) {
    return ctx.reply("Iltimos, rasmni fotosurat (photo) sifatida yuboring, fayl sifatida emas.");
  }
  const fileId = photo[photo.length - 1].file_id;
  ctx.wizard.state.data.photo_file_id = fileId;

  const data = ctx.wizard.state.data;
  const telegramId = ctx.from.id;

  saveApplication(telegramId, data);
  await appendApplication(data, telegramId);

  const caption = [
    `📥 Yangi ariza`,
    ``,
    `1. Joylashgan sanasi: ${data.joylashgan_sanasi}`,
    `2. F.I.Sh.: ${data.fish}`,
    `3. Passport seriyasi: ${data.passport_seriyasi}`,
    `4. Tug'ilgan sanasi: ${data.tugilgan_sanasi}`,
    `5. Jinsi: ${data.jinsi}`,
    `6. Fakulteti: ${data.fakulteti}`,
    `7. Guruh raqami: ${data.guruh_raqami}`,
    `8. Kursi: ${data.kursi}`,
    `9. Ta'lim turi: ${data.talim_turi}`,
    `10. Ta'lim shakli: ${data.talim_shakli}`,
    `11. Viloyat va tuman: ${data.viloyat_tuman}`,
    `12. Telefon raqami: ${data.telefon_raqami}`,
    `13. Ijtimoiy holati: ${data.ijtimoiy_holati}`,
    `14. Xona raqami: ${data.xona_raqami}`,
    `15. Tyutor F.I.Sh va telefon: ${data.tyutor_fish_tel}`,
    ``,
    `👤 Telegram: ${ctx.from.username ? '@' + ctx.from.username : ctx.from.id}`,
  ].join('\n');

  const groupChatId = process.env.GROUP_CHAT_ID;
  if (groupChatId) {
    try {
      await ctx.telegram.sendPhoto(groupChatId, fileId, { caption });
    } catch (err) {
      console.error('Guruhga yuborishda xatolik:', err.message);
    }
  } else {
    console.warn('GROUP_CHAT_ID sozlanmagan — ariza faqat DB/Sheets ga saqlandi.');
  }

  await ctx.reply(
    "✅ Arizangiz qabul qilindi. Rahmat!",
    Markup.removeKeyboard()
  );
  return ctx.scene.leave();
});

const applicationScene = new Scenes.WizardScene('application', ...steps);

module.exports = applicationScene;
