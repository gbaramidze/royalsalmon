// One-off: put the "🍣 Заказать" Mini App button next to the bot's message field and register /menu.
// The server also does this automatically on the first bot sync; run this to apply it right away.
//
//   node --env-file=.env.local scripts/setup-telegram-menu.mjs

const token = process.env.TELEGRAM_BOT_TOKEN;
const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || 'https://royalsalmon.ge').replace(/\/+$/, '');

if (!token) {
  console.error('TELEGRAM_BOT_TOKEN is not set');
  process.exit(1);
}
if (!siteUrl.startsWith('https://')) {
  console.error(`Telegram Mini Apps need HTTPS, got NEXT_PUBLIC_SITE_URL=${siteUrl}`);
  process.exit(1);
}

async function call(method, body) {
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  console.log(method, data.ok ? 'ok' : data);
  return data.ok;
}

const ok =
  (await call('setChatMenuButton', {
    menu_button: { type: 'web_app', text: '🍣 Заказать', web_app: { url: siteUrl } },
  })) &&
  (await call('setMyCommands', {
    commands: [
      { command: 'start', description: 'Начать' },
      { command: 'menu', description: 'Открыть меню и заказать' },
    ],
  }));

process.exit(ok ? 0 : 1);
