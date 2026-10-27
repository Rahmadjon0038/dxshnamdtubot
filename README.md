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

- `ADMIN_IDS` — adminlarning Telegram ID'lari (vergul bilan, masalan `123456789,987654321`). `/restore` va `/broadcast` faqat shu ro'yxatdagilarga, faqat shaxsiy chatda ishlaydi. O'z ID'ingizni botga `/id` yozib bilib oling. Bo'sh qolsa, bu buyruqlar hech kim uchun ishlamaydi.

- Google Sheets (ixtiyoriy):
  1. Google Cloud Console'da Service Account yarating, JSON kalitni yuklab oling.
  2. `.env` ga quyidagilarni to'ldiring:
     - `GOOGLE_SERVICE_ACCOUNT_EMAIL` — JSON dagi `client_email`
     - `GOOGLE_PRIVATE_KEY` — JSON dagi `private_key` (qatorlar orasidagi `\n` larni saqlab, bitta qatorga qo'ying)
     - `GOOGLE_SPREADSHEET_ID` — Google Sheets URL'idagi ID (`.../d/<ID>/edit`)
  3. Yaratilgan spreadsheet'ni Service Account emailiga "Editor" huquqi bilan ulashing (Share).
  4. Bo'sh qoldirilsa, Sheets integratsiyasi avtomatik o'chiq bo'ladi, xatolik bermaydi.

## Foydalanish

- `/start` — botni boshlash, "📝 Ariza topshirish" tugmasi chiqadi. Ariza to'ldirish paytida yozilsa, jarayon bekor qilinadi.
- `/ariza` — ariza formasini boshlash (shu buyruq bilan ham boshlash mumkin). Ariza to'ldirish paytida yozilsa, forma boshidan boshlanadi.
- `/cancel` — joriy jarayonni bekor qilish.
- `/broadcast <matn>` — botdan foydalangan barcha foydalanuvchilarga xabar yuborish (faqat adminlar).
- `/restore [ariza_id]` — bazadagi arizalarni `GROUP_CHAT_ID` ga qayta yuborish (faqat adminlar). Kanaldagi xabarlar tasodifan o'chib ketganda ishlating. Tasdiqlash so'raladi; Telegram limiti (daqiqasiga ~20 xabar) sababli sekin, fonda ishlaydi va jarayon haqida xabar beradi. Uzilib qolsa, `/restore <oxirgi_id>` bilan shu arizadan davom ettiriladi. Aynan bir xil takroriy arizalar (bir vaqtda yuborilgan nusxalar) o'tkazib yuboriladi. Kanalda eski xabarlar qolgan bo'lsa takrorlanadi.

## Ma'lumotlar bazasi

SQLite fayli `data/bot.sqlite` da saqlanadi:
- `users` — botdan foydalangan barcha telegram ID'lar (broadcast uchun).
- `applications` — to'ldirilgan har bir ariza (rasm `file_id` sifatida saqlanadi).

Ariza to'ldirilgach:
1. SQLite'ga yoziladi.
2. (Yoqilgan bo'lsa) Google Sheets'ga qator qo'shiladi.
3. `GROUP_CHAT_ID` ga rasm + barcha ma'lumotlar bitta xabar (caption) qilib yuboriladi.

Asosiy nusxa — bazadagi `applications` jadvali; kanaldagi xabarlar faqat ko'rish uchun. Kanal tozalansa, `/restore` bilan tiklanadi. Shuning uchun `data/bot.sqlite` ni muntazam zaxiralab turing.
