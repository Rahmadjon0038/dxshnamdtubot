const { Markup } = require('telegraf');

const WELCOME_TEXT =
  "Assalomu alaykum! Bu bot orqali talaba ma'lumotlarini topshirishingiz mumkin.\n\nBoshlash uchun tugmani bosing.";

const startKeyboard = () => Markup.keyboard([['📝 Ariza topshirish']]).resize();

module.exports = { WELCOME_TEXT, startKeyboard };
