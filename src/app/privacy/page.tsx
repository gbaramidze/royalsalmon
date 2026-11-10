import React from 'react';
import Link from 'next/link';
import { Metadata } from 'next';
import { RoyalSalmonLogo } from '@/components/RoyalSalmonLogo';
import { PaymentBadges } from '@/components/PaymentLogos';
import { ArrowLeft, ShieldCheck, Lock, FileText, Phone, Mail, MapPin } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Политика конфиденциальности | Royal Salmon Batumi',
  description: 'Политика конфиденциальности и обработки персональных данных службы доставки суши Royal Salmon в Батуми.',
};

export default function PrivacyPage() {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-main, #F7F9FA)', color: 'var(--text-main, #1A202C)', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      {/* Top Header */}
      <header style={{ background: '#FFFFFF', borderBottom: '1px solid var(--border-subtle, #E2E8F0)', padding: '16px 20px', position: 'sticky', top: 0, zIndex: 30 }}>
        <div style={{ maxWidth: 860, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Link href="/" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, textDecoration: 'none', color: 'var(--color-primary, #33BEBF)', fontWeight: 700, fontSize: 14 }}>
            <ArrowLeft size={18} />
            <span>Вернуться в меню</span>
          </Link>

          <Link href="/" style={{ textDecoration: 'none' }} aria-label="Royal Salmon">
            <RoyalSalmonLogo height={34} />
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main style={{ maxWidth: 860, margin: '0 auto', padding: '36px 20px 60px' }}>
        <div style={{ background: '#FFFFFF', borderRadius: 16, padding: '36px 28px', border: '1px solid var(--border-subtle, #E2E8F0)', boxShadow: '0 4px 20px rgba(0,0,0,0.04)' }}>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(51, 190, 191, 0.12)', color: 'var(--color-primary, #33BEBF)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ShieldCheck size={24} />
            </div>
            <div>
              <h1 style={{ fontSize: 24, fontWeight: 900, margin: 0, color: 'var(--text-main, #0F172A)' }}>
                Политика конфиденциальности
              </h1>
              <div style={{ fontSize: 13, color: 'var(--text-secondary, #64748B)', marginTop: 2 }}>
                Privacy Policy • Дата редакции: 1 января 2026 г.
              </div>
            </div>
          </div>

          <div style={{ height: 1, background: 'var(--border-subtle, #E2E8F0)', margin: '24px 0' }} />

          <section style={{ marginBottom: 28 }}>
            <h2 style={{ fontSize: 18, fontWeight: 800, marginBottom: 10, color: 'var(--text-main, #0F172A)' }}>
              1. Общие положения
            </h2>
            <p style={{ fontSize: 14.5, lineHeight: 1.65, color: '#334155', margin: 0 }}>
              Настоящая Политика конфиденциальности регулирует порядок обработки и защиты персональных данных пользователей сервиса онлайн-заказа и доставки ресторанных блюд <b>Royal Salmon</b> (г. Батуми, Грузия).
              Мы уважительно относимся к конфиденциальности каждого гостя и строго соблюдаем законодательство Грузии «О защите персональных данных».
            </p>
          </section>

          <section style={{ marginBottom: 28 }}>
            <h2 style={{ fontSize: 18, fontWeight: 800, marginBottom: 10, color: 'var(--text-main, #0F172A)' }}>
              2. Какие данные мы собираем
            </h2>
            <p style={{ fontSize: 14.5, lineHeight: 1.65, color: '#334155', marginBottom: 10 }}>
              При оформлении заказа суши и роллов мы запрашиваем минимально необходимый объем данных для качественного исполнения доставки:
            </p>
            <ul style={{ fontSize: 14.5, lineHeight: 1.65, color: '#334155', paddingLeft: 20, margin: 0 }}>
              <li><b>Номер телефона:</b> используется для отправки проверочного кода (по СМС или Telegram), координации с курьером и подтверждения состава заказа.</li>
              <li><b>Имя клиента:</b> для обращения при подтверждении и доставке.</li>
              <li><b>Адрес доставки:</b> улица, дом, номер подъезда/квартиры, этаж и комментарии для курьера.</li>
              <li><b>Состав заказа и комментарии:</b> выбранные роллы, сеты, соусы и пожелания по приготовлению.</li>
            </ul>
          </section>

          <section style={{ marginBottom: 28 }}>
            <h2 style={{ fontSize: 18, fontWeight: 800, marginBottom: 10, color: 'var(--text-main, #0F172A)' }}>
              3. Проверка номера через СМС и Telegram
            </h2>
            <p style={{ fontSize: 14.5, lineHeight: 1.65, color: '#334155', margin: 0 }}>
              В целях защиты от спама и фиктивных заказов сервис Royal Salmon использует верификацию номера телефона. Пользователь вправе выбрать удобный способ подтверждения: 
              <b> получение одноразового кода по СМС</b> либо через официального Telegram-бота <b>@royalsalmon_bot</b>. 
              Код действует ограниченное время (10 минут) и служит исключительно для удостоверения подлинности заказа.
            </p>
          </section>

          <section style={{ marginBottom: 28 }}>
            <h2 style={{ fontSize: 18, fontWeight: 800, marginBottom: 10, color: 'var(--text-main, #0F172A)' }}>
              4. Безопасность банковских платежей (Visa и Mastercard)
            </h2>
            <div style={{ background: 'rgba(51, 190, 191, 0.06)', border: '1px solid rgba(51, 190, 191, 0.25)', borderRadius: 12, padding: 18, marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                <PaymentBadges />
                <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--color-primary, #33BEBF)' }}>
                  Стандарт PCI DSS
                </span>
              </div>
              <p style={{ fontSize: 14, lineHeight: 1.6, color: '#334155', margin: 0 }}>
                Сервис <b>Royal Salmon не собирает и не хранит данные ваших банковских карт</b> (полный номер, CVV/CVC-код, срок действия).
                Оплата банковскими картами <b>Visa</b> и <b>Mastercard</b> осуществляется через защищенные платежные шлюзы ведущих банков Грузии:
                <b> Bank of Georgia (BOG iPay)</b> и <b>TBC Bank Checkout / Apple Pay</b> с использованием протоколов шифрования 3-D Secure и TLS.
              </p>
            </div>
          </section>

          <section style={{ marginBottom: 28 }}>
            <h2 style={{ fontSize: 18, fontWeight: 800, marginBottom: 10, color: 'var(--text-main, #0F172A)' }}>
              5. Файлы Cookie и локальное хранилище
            </h2>
            <p style={{ fontSize: 14.5, lineHeight: 1.65, color: '#334155', margin: 0 }}>
              Сайт использует файлы cookie и локальное хранилище браузера (localStorage) исключительно для технических нужд: сохранения содержимого текущей корзины, выбранного языка интерфейса (RU, KA, EN) и истории ваших заказов на данном устройстве.
            </p>
          </section>

          <section style={{ marginBottom: 28 }}>
            <h2 style={{ fontSize: 18, fontWeight: 800, marginBottom: 10, color: 'var(--text-main, #0F172A)' }}>
              6. Контакты и обратная связь
            </h2>
            <p style={{ fontSize: 14.5, lineHeight: 1.65, color: '#334155', marginBottom: 12 }}>
              По любым вопросам, касающимся обработки персональных данных или отзыва согласия, вы можете связаться с нами:
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 14, color: '#334155' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Phone size={15} color="var(--color-primary, #33BEBF)" />
                <a href="tel:+995550505454" style={{ color: 'inherit', textDecoration: 'none', fontWeight: 600 }}>+995 550 505 454</a>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <MapPin size={15} color="var(--color-primary, #33BEBF)" />
                <span>Батуми, ул. Джавахишвили, 9, Грузия</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Mail size={15} color="var(--color-primary, #33BEBF)" />
                <span>info@royalsalmon.ge</span>
              </div>
            </div>
          </section>

        </div>
      </main>

      {/* Footer */}
      <footer style={{ background: '#0F172A', color: '#94A3B8', padding: '30px 20px', borderTop: '1px solid #1E293B', textAlign: 'center', fontSize: 13 }}>
        <div style={{ maxWidth: 860, margin: '0 auto', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <PaymentBadges />
          </div>
          <div style={{ display: 'flex', gap: 16 }}>
            <Link href="/" style={{ color: '#E2E8F0', textDecoration: 'none' }}>Главное меню</Link>
            <span>•</span>
            <Link href="/terms" style={{ color: '#E2E8F0', textDecoration: 'none' }}>Условия обслуживания</Link>
          </div>
          <div>© {new Date().getFullYear()} Royal Salmon Batumi. Все права защищены.</div>
        </div>
      </footer>
    </div>
  );
}
