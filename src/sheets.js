const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library');

const {
  GOOGLE_SERVICE_ACCOUNT_EMAIL,
  GOOGLE_PRIVATE_KEY,
  GOOGLE_SPREADSHEET_ID,
} = process.env;

const isEnabled = Boolean(
  GOOGLE_SERVICE_ACCOUNT_EMAIL && GOOGLE_PRIVATE_KEY && GOOGLE_SPREADSHEET_ID
);

const HEADERS = [
  'Joylashgan sanasi',
  'F.I.Sh',
  'Passport seriyasi',
  "Tug'ilgan sanasi",
  'Jinsi',
  'Fakulteti',
  'Guruh raqami',
  'Kursi',
  "Ta'lim turi",
  "Ta'lim shakli",
  'Viloyat va tuman',
  'Telefon raqami',
  'Ijtimoiy holati',
  'Xona raqami',
  'Tyutor F.I.Sh va telefon',
  'Telegram ID',
  'Sana',
];

let docPromise = null;

async function getDoc() {
  if (!isEnabled) return null;
  if (!docPromise) {
    const jwt = new JWT({
      email: GOOGLE_SERVICE_ACCOUNT_EMAIL,
      key: GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    const doc = new GoogleSpreadsheet(GOOGLE_SPREADSHEET_ID, jwt);
    docPromise = doc.loadInfo().then(async () => {
      let sheet = doc.sheetsByIndex[0];
      if (!sheet) {
        sheet = await doc.addSheet({ title: 'Arizalar', headerValues: HEADERS });
      } else {
        try {
          await sheet.loadHeaderRow();
        } catch {
          await sheet.setHeaderRow(HEADERS);
        }
      }
      return { doc, sheet };
    });
  }
  return docPromise;
}

async function appendApplication(data, telegramId) {
  if (!isEnabled) return;
  try {
    const { sheet } = await getDoc();
    await sheet.addRow({
      'Joylashgan sanasi': data.joylashgan_sanasi,
      'F.I.Sh': data.fish,
      'Passport seriyasi': data.passport_seriyasi,
      "Tug'ilgan sanasi": data.tugilgan_sanasi,
      Jinsi: data.jinsi,
      Fakulteti: data.fakulteti,
      'Guruh raqami': data.guruh_raqami,
      Kursi: data.kursi,
      "Ta'lim turi": data.talim_turi,
      "Ta'lim shakli": data.talim_shakli,
      'Viloyat va tuman': data.viloyat_tuman,
      'Telefon raqami': data.telefon_raqami,
      'Ijtimoiy holati': data.ijtimoiy_holati,
      'Xona raqami': data.xona_raqami,
      'Tyutor F.I.Sh va telefon': data.tyutor_fish_tel,
      'Telegram ID': telegramId,
      Sana: new Date().toISOString(),
    });
  } catch (err) {
    console.error("Google Sheets'ga yozishda xatolik:", err.message);
  }
}

module.exports = { appendApplication, isEnabled };
