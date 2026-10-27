const { getApplications } = require('./db');
const { buildCaption, sendApplication, sleep } = require('./applicationPost');

// Guruh/kanalga daqiqasiga ~20 xabar limiti bor: 3.1 soniya oralig'i ~19 xabar/daqiqa.
const SEND_INTERVAL_MS = 3100;
const PROGRESS_EVERY = 25;
const MAX_CONSECUTIVE_FAILURES = 3;

// Rasm har bir nusxada farq qilishi mumkin (albomdan), shuning uchun takrorni aniqlashda hisobga olinmaydi.
const NOT_DUPLICATE_KEY = new Set(['id', 'created_at', 'photo_file_id', 'username']);
const duplicateKey = (app) =>
  Object.keys(app)
    .filter((key) => !NOT_DUPLICATE_KEY.has(key))
    .map((key) => app[key])
    .join('\u0001');

async function restoreApplications({
  telegram,
  chatId,
  botUsername,
  fromId = 0,
  limit = 0,
  intervalMs = SEND_INTERVAL_MS,
  onProgress,
}) {
  const all = getApplications(fromId);
  const applications = limit > 0 ? all.slice(0, limit) : all;
  const result = {
    total: applications.length,
    sent: 0,
    textOnly: [],
    failed: [],
    duplicates: [],
    lastId: null,
    nextId: all[applications.length]?.id ?? null,
    aborted: null,
    resumeFrom: null,
  };
  let consecutiveFailures = 0;
  let firstFailureInRun = null;
  const sentKeys = new Set();

  for (const [index, app] of applications.entries()) {
    const key = duplicateKey(app);
    let apiCalled = false;

    if (sentKeys.has(key)) {
      result.duplicates.push(app.id);
    } else {
      apiCalled = true;
      const caption = buildCaption(app, {
        username: app.username,
        telegramId: app.telegram_id,
        botUsername,
        createdAt: app.created_at,
      });

      try {
        const mode = await sendApplication(telegram, chatId, app.photo_file_id, caption);
        result.sent++;
        sentKeys.add(key);
        if (mode === 'text') result.textOnly.push(app.id);
        consecutiveFailures = 0;
        firstFailureInRun = null;
      } catch (err) {
        console.error(`Ariza #${app.id} ni qayta yuborib bo'lmadi:`, err.message);
        result.failed.push(app.id);
        firstFailureInRun ??= app.id;
        // Ketma-ket muvaffaqiyatsizlik odatda noto'g'ri chat ID yoki botda huquq yo'qligini
        // bildiradi — yuzlab arizani behuda urinib ko'rmaslik uchun to'xtaymiz.
        if (++consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
          result.aborted = err.message;
          result.resumeFrom = firstFailureInRun;
          break;
        }
      }
    }

    result.lastId = app.id;
    if (onProgress && (index + 1) % PROGRESS_EVERY === 0) {
      onProgress(index + 1, applications.length, app.id);
    }
    if (apiCalled && index < applications.length - 1) await sleep(intervalMs);
  }

  return result;
}

module.exports = { restoreApplications, SEND_INTERVAL_MS };
