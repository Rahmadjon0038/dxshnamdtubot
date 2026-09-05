# dxshnamdtuBot

Talaba ma'lumotlarini yig'uvchi Telegram bot (Telegraf + better-sqlite3).

## Ishga tushirish

```bash
npm install
npm start
```

## Sozlash (.env)

- `BOT_TOKEN` — tayyor, allaqachon qo'yilgan.
- `GROUP_CHAT_ID` — arizalar yuboriladigan guruh/kanal ID'si. Buni topish uchun:
  1. Botni guruhga admin qilib qo'shing.
  2. Guruhga biror xabar yozing, so'ng `https://api.telegram.org/bot<TOKEN>/getUpdates` ni brauzerda oching va `"chat":{"id":...}` qiymatini toping (odatda `-100...` bilan boshlanadi).
  3. Shu ID ni `.env` dagi `GROUP_CHAT_ID` ga yozing va botni qayta ishga tushiring.

- Google Sheets (ixtiyoriy):
  1. Google Cloud Console'da Service Account yarating, JSON kalitni yuklab oling.
  2. `.env` ga quyidagilarni to'ldiring:
     - `GOOGLE_SERVICE_ACCOUNT_EMAIL` — JSON dagi `client_email`
     - `GOOGLE_PRIVATE_KEY` — JSON dagi `private_key` (qatorlar orasidagi `\n` larni saqlab, bitta qatorga qo'ying)
     - `GOOGLE_SPREADSHEET_ID` — Google Sheets URL'idagi ID (`.../d/<ID>/edit`)
  3. Yaratilgan spreadsheet'ni Service Account emailiga "Editor" huquqi bilan ulashing (Share).
  4. Bo'sh qoldirilsa, Sheets integratsiyasi avtomatik o'chiq bo'ladi, xatolik bermaydi.

## Foydalanish

- `/start` — botni boshlash, "📝 Ariza topshirish" tugmasi chiqadi.
- `/ariza` — ariza formasini boshlash (shu buyruq bilan ham boshlash mumkin).
- `/cancel` — joriy jarayonni bekor qilish.
- `/broadcast <matn>` — botdan foydalangan barcha foydalanuvchilarga xabar yuborish.

## Ma'lumotlar bazasi

SQLite fayli `data/bot.sqlite` da saqlanadi:
- `users` — botdan foydalangan barcha telegram ID'lar (broadcast uchun).
- `applications` — to'ldirilgan har bir ariza (rasm `file_id` sifatida saqlanadi).

Ariza to'ldirilgach:
1. SQLite'ga yoziladi.
2. (Yoqilgan bo'lsa) Google Sheets'ga qator qo'shiladi.
3. `GROUP_CHAT_ID` ga rasm + barcha ma'lumotlar bitta xabar (caption) qilib yuboriladi.
