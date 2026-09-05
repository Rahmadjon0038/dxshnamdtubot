const { Scenes, Markup } = require('telegraf');
const { saveApplication } = require('../db');
const { appendApplication } = require('../sheets');

const CANCEL_TEXT = '❌ Bekor qilish';
const OTHER_TEXT = 'Boshqa';

const QUESTIONS = [
  {
    key: 'joylashgan_sanasi',
    title: '1. Talabalar turar joyiga joylashgan sana',
    type: 'text',
    example: '01.09.2026',
  },
  { key: 'fish', title: '2. F.I.Sh. toʻliq', type: 'text', example: "Aliyev Vali Aliyevich o'g'li" },
  { key: 'passport_seriyasi', title: '3. Passport seriyasi', type: 'text', example: 'AD1234567' },
  {
    key: 'tugilgan_sanasi',
    title: "4. Tug'ilgan sanasi (kun,oy,yil)",
    type: 'text',
    example: '15.03.2005',
  },
  { key: 'jinsi', title: '5. Jinsi', type: 'choice', options: ['Erkak', 'Ayol'] },
  { key: 'fakulteti', title: '6. Fakulteti', type: 'text', example: 'Iqtisodiyot fakulteti' },
  { key: 'guruh_raqami', title: '7. Guruh raqami', type: 'text', example: '21-201' },
  { key: 'kursi', title: '8. Kursi', type: 'choice', options: ['1', '2', '3', '4'] },
  { key: 'talim_turi', title: "9. Ta'lim turi", type: 'choice', options: ['Kontrakt', 'Grant'] },
  { key: 'talim_shakli', title: "10. Ta'lim shakli", type: 'choice', options: ['Kunduzgi', 'Kechki', 'Sirtqi'] },
  {
    key: 'viloyat_tuman',
    title: '11. Viloyati va tumani',
    type: 'text',
    example: 'Toshkent viloyati, Chirchiq tumani',
  },
  { key: 'telefon_raqami', title: '12. Telefon raqami', type: 'contact', example: '+998901234567' },
  {
    key: 'ijtimoiy_holati',
    title: '13. Ijtimoiy holati',
    type: 'choice',
    options: ['Temir daftar', 'Nogironligi bor', "Boquvchisi yo'q", 'Chin yetim', OTHER_TEXT],
    allowOther: true,
  },
  { key: 'xona_raqami', title: '14. Xona raqami', type: 'text', example: '305' },
  {
    key: 'tyutor_fish_tel',
    title: '15. Tyutor F.I.Sh va telefon raqami',
    type: 'text',
    example: "Karimova Nodira, +998901234567",
  },
];

const TOTAL_STEPS = QUESTIONS.length + 1;

function chunk(arr, size) {
  const rows = [];
  for (let i = 0; i < arr.length; i += size) rows.push(arr.slice(i, i + size));
  return rows;
}

function keyboardFor(question) {
  if (question.type === 'choice') {
    return Markup.keyboard([...chunk(question.options, 2), [CANCEL_TEXT]]).resize();
  }
  if (question.type === 'contact') {
    return Markup.keyboard([
      [Markup.button.contactRequest('📱 Raqamni yuborish')],
      [CANCEL_TEXT],
    ]).resize();
  }
  return Markup.keyboard([[CANCEL_TEXT]]).resize();
}

function questionPrompt(question, stepNumber) {
  let text = `${question.title}:`;
  if (question.type === 'choice') {
    text += '\n\nQuyidagi tugmalardan birini tanlang.';
  } else if (question.type === 'contact') {
    text += "\n\nTugma orqali yuboring yoki qo'lda kiriting.";
  }
  if (question.example) {
    text += `\n\n💡 Misol: ${question.example}`;
  }
  text += `\n\n(${stepNumber}/${TOTAL_STEPS})`;
  return text;
}

async function askQuestion(ctx, question, stepNumber) {
  await ctx.reply(questionPrompt(question, stepNumber), keyboardFor(question));
}

function buildStepHandler(index) {
  const question = QUESTIONS[index - 1];

  return async (ctx) => {
    if (ctx.message?.text === CANCEL_TEXT) {
      ctx.scene.leave();
      return ctx.reply('Ariza bekor qilindi.', Markup.keyboard([['📝 Ariza topshirish']]).resize());
    }

    // "Boshqa" tanlanganda qo'shimcha aniqlashtiruvchi javobni kutish holati
    if (ctx.wizard.state.awaitingOtherFor === question.key) {
      if (!ctx.message?.text) {
        return ctx.reply("Iltimos, matn ko'rinishida javob bering.");
      }
      ctx.wizard.state.data[question.key] = ctx.message.text.trim();
      ctx.wizard.state.awaitingOtherFor = null;
      return advance(ctx, index);
    }

    if (question.type === 'contact') {
      const contactPhone = ctx.message?.contact?.phone_number;
      const typedText = ctx.message?.text;
      if (!contactPhone && !typedText) {
        return ctx.reply(
          "Iltimos, tugma orqali raqamingizni yuboring yoki qo'lda kiriting."
        );
      }
      ctx.wizard.state.data[question.key] = contactPhone
        ? `+${contactPhone.replace(/^\+/, '')}`
        : typedText.trim();
      return advance(ctx, index);
    }

    if (!ctx.message || !ctx.message.text) {
      return ctx.reply("Iltimos, matn ko'rinishida javob bering.");
    }
    const answer = ctx.message.text.trim();

    if (question.type === 'choice' && question.allowOther && answer === OTHER_TEXT) {
      ctx.wizard.state.awaitingOtherFor = question.key;
      await ctx.reply(
        "Iltimos, aniqlashtiring (masalan: ko'p bolali oila, va h.k.):",
        Markup.keyboard([[CANCEL_TEXT]]).resize()
      );
      return;
    }

    ctx.wizard.state.data[question.key] = answer;
    return advance(ctx, index);
  };
}

async function advance(ctx, index) {
  if (index < QUESTIONS.length) {
    await askQuestion(ctx, QUESTIONS[index], index + 1);
    return ctx.wizard.next();
  }
  await ctx.reply(
    `16. 3.5x4.5 rasm yuboring (fotosurat sifatida):\n\n(${TOTAL_STEPS}/${TOTAL_STEPS})`,
    Markup.keyboard([[CANCEL_TEXT]]).resize()
  );
  return ctx.wizard.next();
}

const steps = [
  async (ctx) => {
    ctx.wizard.state.data = {};
    ctx.wizard.state.awaitingOtherFor = null;
    await ctx.reply(
      "Ariza topshirish boshlandi. Har bir savolga navbat bilan javob bering."
    );
    await askQuestion(ctx, QUESTIONS[0], 1);
    return ctx.wizard.next();
  },
];

for (let i = 1; i <= QUESTIONS.length; i++) {
  steps.push(buildStepHandler(i));
}

steps.push(async (ctx) => {
  if (ctx.message?.text === CANCEL_TEXT) {
    ctx.scene.leave();
    return ctx.reply('Ariza bekor qilindi.', Markup.keyboard([['📝 Ariza topshirish']]).resize());
  }

  const photo = ctx.message?.photo;
  if (!photo || photo.length === 0) {
    return ctx.reply("Iltimos, rasmni fotosurat (photo) sifatida yuboring, fayl sifatida emas.");
  }
  const fileId = photo[photo.length - 1].file_id;
  ctx.wizard.state.data.photo_file_id = fileId;

  const data = ctx.wizard.state.data || {};
  const telegramId = ctx.from.id;

  try {
    saveApplication(telegramId, data);
    await appendApplication(data, telegramId);
  } catch (err) {
    console.error('Arizani saqlashda xatolik:', err, JSON.stringify(data));
  }

  const v = (val) => (val ? val : '—');
  const caption = [
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
    `👤 Telegram: ${ctx.from.username ? '@' + ctx.from.username : ctx.from.id}`,
    ``,
    `🤖 @${ctx.botInfo?.username || 'DxshNamdtuBot'}`,
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
    '✅ Arizangiz qabul qilindi. Rahmat!',
    Markup.keyboard([['📝 Ariza topshirish']]).resize()
  );
  return ctx.scene.leave();
});

const applicationScene = new Scenes.WizardScene('application', ...steps);

module.exports = applicationScene;
