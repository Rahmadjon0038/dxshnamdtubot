const { Scenes, Markup } = require('telegraf');
const { saveApplication } = require('../db');
const { appendApplication } = require('../sheets');
const { buildCaption, sendApplication } = require('../applicationPost');
const { WELCOME_TEXT, startKeyboard } = require('../messages');

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
  { key: 'telefon_raqami', title: '12. Telefon raqami', type: 'text', example: '+998901234567' },
  {
    key: 'ijtimoiy_holati',
    title: '13. Ijtimoiy holati',
    type: 'choice',
    options: ['Yaxshi', 'Temir daftar', 'Nogironligi bor', "Boquvchisi yo'q", 'Chin yetim', OTHER_TEXT],
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

async function startForm(ctx) {
  ctx.wizard.state.data = {};
  ctx.wizard.state.awaitingOtherFor = null;
  ctx.wizard.state.submitted = false;
  await ctx.reply(
    "Ariza topshirish boshlandi. Har bir savolga navbat bilan javob bering."
  );
  await askQuestion(ctx, QUESTIONS[0], 1);
  return ctx.wizard.selectStep(1);
}

const steps = [startForm];

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
  // Bir vaqtda kelgan bir nechta rasm (albom yoki qayta yuborish) arizani takror saqlamasligi
  // uchun: holat barcha parallel xabarlar uchun umumiy, belgi await'dan oldin o'rnatiladi.
  if (ctx.wizard.state.submitted) return;
  ctx.wizard.state.submitted = true;

  const fileId = photo[photo.length - 1].file_id;
  ctx.wizard.state.data.photo_file_id = fileId;

  const data = ctx.wizard.state.data || {};
  const telegramId = ctx.from.id;

  try {
    saveApplication(telegramId, data);
  } catch (err) {
    console.error('Arizani saqlashda xatolik:', err, JSON.stringify(data));
  }
  // Google Sheets'ga yozish tarmoq orqali sekin bo'lishi mumkin (ayniqsa
  // birinchi chaqiruvda autentifikatsiya bilan) — foydalanuvchini kutdirmaslik
  // uchun buni fonda bajaramiz, javob yuborishni kutmaymiz.
  appendApplication(data, telegramId).catch((err) =>
    console.error("Google Sheets'ga yozishda xatolik:", err)
  );

  const caption = buildCaption(data, {
    username: ctx.from.username,
    telegramId,
    botUsername: ctx.botInfo?.username,
  });

  // Guruhga yuborish fonda bajariladi: foydalanuvchi javobni kutmaydi, Telegram limiti
  // (429) bo'lsa ham kechikmaydi. Ariza bazada saqlangan, kerak bo'lsa /restore bilan
  // qayta yuborish mumkin.
  const groupChatId = process.env.GROUP_CHAT_ID;
  if (groupChatId) {
    sendApplication(ctx.telegram, groupChatId, fileId, caption).catch((err) =>
      console.error('Guruhga yuborishda xatolik:', err.message)
    );
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

// Wizard har qanday xabarni "javob" deb qabul qiladi, shuning uchun buyruqlar shu yerda
// alohida ushlanadi — aks holda talaba jarayondan chiqa olmay, bot "qotib qolgandek" bo'ladi.
applicationScene.command('cancel', async (ctx) => {
  await ctx.scene.leave();
  return ctx.reply('Ariza bekor qilindi.', startKeyboard());
});
applicationScene.command('start', async (ctx) => {
  await ctx.scene.leave();
  return ctx.reply(WELCOME_TEXT, startKeyboard());
});
// Diqqat: bu yerda ctx.scene.reenter() ishlatmang — u joriy xabarni sahnaga qayta beradi va
// shu buyruq cheksiz takrorlanib, jarayon xotirasi to'lib qulaydi.
applicationScene.command('ariza', startForm);

module.exports = applicationScene;
