// One-time import of the old JSON storage (data/*.json, data/complaints/) into Supabase.
// Run after applying supabase/migrations:  node --env-file=.env.local scripts/import-json-to-supabase.mjs
// Safe to re-run: rows are upserted by their ids.

import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (e.g. in .env.local)');
  process.exit(1);
}

const db = createClient(url, serviceKey, { auth: { persistSession: false } });
const DATA_DIR = path.join(process.cwd(), 'data');
const BUCKET = 'complaint-photos';
const MIME = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };

const readJson = file => {
  const full = path.join(DATA_DIR, file);
  return fs.existsSync(full) ? JSON.parse(fs.readFileSync(full, 'utf-8')) : null;
};
const normalizePhone = phone => String(phone || '').replace(/[\s\-()]/g, '').trim();
const iso = ms => new Date(ms).toISOString();

async function run(action, promise) {
  const { error } = await promise;
  if (error) throw new Error(`${action}: ${error.message}`);
}

async function importOrders() {
  const orders = Object.values(readJson('orders.json') || {});

  for (const o of orders) {
    await run(`order ${o.orderNumber}`, db.from('orders').upsert({
      id: o.id,
      order_number: o.orderNumber,
      customer_name: o.customerName,
      customer_phone: normalizePhone(o.customerPhone),
      customer_email: o.customerEmail || null,
      delivery_type: o.deliveryType,
      address: o.address,
      lat: o.coordinates?.lat ?? null,
      lng: o.coordinates?.lng ?? null,
      apartment: o.apartment || null,
      entrance: o.entrance || null,
      floor: o.floor || null,
      intercom: o.intercom || null,
      notes: o.notes || null,
      subtotal: o.subtotal,
      delivery_fee: o.deliveryFee ?? 0,
      tax: o.tax ?? 0,
      total: o.total,
      payment_method: o.paymentMethod,
      payment_status: o.paymentStatus,
      status: o.status,
      created_at: o.createdAt,
      status_updated_at: o.statusUpdatedAt || o.createdAt,
      delivery_started_at: o.deliveryStartedAt || null,
      eta_minutes: o.etaMinutes ?? null,
      courier_token: o.courierToken || null,
      courier_lat: o.courier?.lat ?? null,
      courier_lng: o.courier?.lng ?? null,
      courier_updated_at: o.courier?.updatedAt || null,
    }));

    await run(`items of ${o.orderNumber}`, db.from('order_items').delete().eq('order_id', o.id));
    await run(`items of ${o.orderNumber}`, db.from('order_items').insert(
      (o.items || []).map((it, position) => ({
        order_id: o.id,
        position,
        item_id: it.itemId || '',
        name: it.name,
        quantity: it.quantity,
        price: it.price,
        modifiers_description: it.modifiersDescription || null,
      }))
    ));

    for (const c of o.complaints || []) {
      const photos = [];
      for (const relative of c.photos || []) {
        const file = path.join(DATA_DIR, relative);
        if (!fs.existsSync(file)) continue;
        const objectPath = `${c.id}/${path.basename(file)}`;
        const ext = path.extname(file).slice(1).toLowerCase();
        await run(`photo ${relative}`, db.storage.from(BUCKET).upload(objectPath, fs.readFileSync(file), {
          contentType: MIME[ext] || 'image/jpeg',
          upsert: true,
        }));
        photos.push(objectPath);
      }

      await run(`complaint ${c.id}`, db.from('order_complaints').upsert({
        id: c.id,
        order_id: o.id,
        created_at: c.createdAt,
        items: c.items || [],
        description: c.description,
        photos,
      }));
    }
  }
  console.log(`Orders: ${orders.length}`);
}

async function importTelegram() {
  const store = readJson('telegram_sessions.json');
  if (!store) return console.log('Telegram: nothing to import');

  const contacts = Object.entries(store.knownUsers || {}).map(([contact, chatId]) => ({
    contact: contact.startsWith('@') ? contact.toLowerCase() : normalizePhone(contact),
    chat_id: chatId,
  }));
  if (contacts.length) await run('telegram contacts', db.from('telegram_contacts').upsert(contacts));

  const chats = (store.recentChats || []).map(c => ({
    chat_id: c.chatId,
    username: c.username || null,
    first_name: c.firstName || null,
    updated_at: iso(c.updatedAt),
  }));
  if (chats.length) await run('telegram chats', db.from('telegram_chats').upsert(chats));

  const sessions = Object.entries(store.sessions || {}).map(([phone, s]) => ({
    phone: normalizePhone(phone),
    code: s.code,
    chat_id: s.chatId ?? null,
    created_at: iso(s.createdAt),
    verified: Boolean(s.verified),
  }));
  if (sessions.length) await run('otp sessions', db.from('otp_sessions').upsert(sessions));

  if (store.lastUpdateId) {
    await run('bot state', db.from('bot_state').upsert({ key: 'telegram_last_update_id', value: store.lastUpdateId }));
  }
  console.log(`Telegram: ${contacts.length} contacts, ${chats.length} chats, ${sessions.length} codes`);
}

try {
  await importOrders();
  await importTelegram();
  console.log('Done. The data/ folder is no longer used by the app and can be archived.');
} catch (error) {
  console.error('Import failed:', error.message);
  process.exit(1);
}
