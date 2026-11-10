import React from 'react';
import Link from 'next/link';
import { Metadata } from 'next';
import { RoyalSalmonLogo } from '@/components/RoyalSalmonLogo';
import { PaymentBadges } from '@/components/PaymentLogos';
import { ArrowLeft, FileText, CheckCircle2, AlertCircle, Phone, Mail, MapPin } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Условия обслуживания и правила доставки | Royal Salmon Batumi',
  description: 'Пользовательское соглашение, правила заказа, оплаты и доставки суши Royal Salmon в Батуми.',
};

export default function TermsPage() {
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
              <FileText size={24} />
            </div>
            <div>
              <h1 style={{ fontSize: 24, fontWeight: 900, margin: 0, color: 'var(--text-main, #0F172A)' }}>
                Пользовательское соглашение и условия доставки
              </h1>
              <div style={{ fontSize: 13, color: 'var(--text-secondary, #64748B)', marginTop: 2 }}>
                Terms & Conditions • Ресторанная доставка Royal Salmon (Батуми)
              </div>
            </div>
          </div>

          <div style={{ height: 1, background: 'var(--border-subtle, #E2E8F0)', margin: '24px 0' }} />

          <section style={{ marginBottom: 28 }}>
            <h2 style={{ fontSize: 18, fontWeight: 800, marginBottom: 10, color: 'var(--text-main, #0F172A)' }}>
              1. Предмет соглашения
            </h2>
            <p style={{ fontSize: 14.5, lineHeight: 1.65, color: '#334155', margin: 0 }}>
              Настоящие Условия определяют правила оформления заказов, приготовления, оплаты и доставки блюд японской и паназиатской кухни сервисом <b>Royal Salmon</b> в городе Батуми. 
              Оформляя заказ на сайте, клиент подтверждает согласие с настоящими условиями.
            </p>
          </section>

          <section style={{ marginBottom: 28 }}>
            <h2 style={{ fontSize: 18, fontWeight: 800, marginBottom: 10, color: 'var(--text-main, #0F172A)' }}>
              2. Оформление заказа и верификация номера
            </h2>
            <p style={{ fontSize: 14.5, lineHeight: 1.65, color: '#334155', marginBottom: 10 }}>
              Для оформления заказа гость указывает актуальный номер телефона и выбирает способ подтверждения:
            </p>
            <ul style={{ fontSize: 14.5, lineHeight: 1.65, color: '#334155', paddingLeft: 20, margin: '0 0 10px 0' }}>
              <li><b>Подтверждение через СМС:</b> отправка одноразового 4-значного кода на мобильный номер.</li>
              <li><b>Подтверждение через Telegram:</b> отправка проверочного кода в чат-бот <b>@royalsalmon_bot</b>.</li>
            </ul>
            <p style={{ fontSize: 14.5, lineHeight: 1.65, color: '#334155', margin: 0 }}>
              Верификация номера необходима для предотвращения ложных заказов и быстрой связи курьера с заказчиком при передаче блюд.
            </p>
          </section>

          <section style={{ marginBottom: 28 }}>
            <h2 style={{ fontSize: 18, fontWeight: 800, marginBottom: 10, color: 'var(--text-main, #0F172A)' }}>
              3. Способы оплаты (Visa, Mastercard, BOG, TBC)
            </h2>
            <div style={{ background: '#F8FAFC', border: '1px solid var(--border-subtle, #E2E8F0)', borderRadius: 12, padding: 18, marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                <PaymentBadges />
                <span style={{ fontSize: 13, fontWeight: 700, color: '#0F172A' }}>Банковские карты и Apple Pay</span>
              </div>
              <ul style={{ fontSize: 14, lineHeight: 1.6, color: '#334155', paddingLeft: 18, margin: 0 }}>
                <li><b>Онлайн-оплата картами Visa и Mastercard:</b> мгновенное списание в национальной валюте Грузии (GEL) без скрытых комиссий.</li>
                <li><b>Bank of Georgia (BOG iPay):</b> прямая быстрая оплата для клиентов Bank of Georgia.</li>
                <li><b>TBC Bank Checkout / Apple Pay:</b> оплата в один клик через приложение TBC или Face ID / Touch ID.</li>
                <li><b>При получении:</b> оплата наличными или банковской картой через POS-терминал курьера.</li>
              </ul>
            </div>
          </section>

          <section style={{ marginBottom: 28 }}>
            <h2 style={{ fontSize: 18, fontWeight: 800, marginBottom: 10, color: 'var(--text-main, #0F172A)' }}>
              4. Условия и время доставки
            </h2>
            <ul style={{ fontSize: 14.5, lineHeight: 1.65, color: '#334155', paddingLeft: 20, margin: 0 }}>
              <li><b>Зона доставки:</b> город Батуми и прилегающие районы.</li>
              <li><b>Время приготовления и доставки:</b> в среднем составляет от 35 до 55 минут с момента подтверждения (в часы пик или при плохих погодных условиях время может быть увеличено с обязательным предупреждением гостя).</li>
              <li><b>Комплектация:</b> к каждому заказу бесплатно прилагаются палочки, соевый соус, васаби и маринованный имбирь в расчете на количество персон.</li>
              <li><b>Бесплатная доставка:</b> при сумме заказа от 100 GEL доставка осуществляется бесплатно (при сумме до 100 GEL — 5 GEL).</li>
            </ul>
          </section>

          <section style={{ marginBottom: 28 }}>
            <h2 style={{ fontSize: 18, fontWeight: 800, marginBottom: 10, color: 'var(--text-main, #0F172A)' }}>
              5. Контроль качества и отмена заказа
            </h2>
            <p style={{ fontSize: 14.5, lineHeight: 1.65, color: '#334155', margin: 0 }}>
              Все блюда готовятся исключительно из свежих ингредиентов под заказ непосредственно перед отправкой.
              Клиент вправе отказаться от заказа без удержания средств в течение 5 минут после подтверждения (до начала приготовления). 
              При обнаружении несоответствия комплектации или повреждения упаковки во время доставки Royal Salmon производит оперативную бесплатную замену блюда либо возврат денежных средств.
            </p>
          </section>

          <section style={{ marginBottom: 28 }}>
            <h2 style={{ fontSize: 18, fontWeight: 800, marginBottom: 10, color: 'var(--text-main, #0F172A)' }}>
              6. Контакты службы поддержки
            </h2>
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
                <span>orders@royalsalmon.ge</span>
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
            <Link href="/privacy" style={{ color: '#E2E8F0', textDecoration: 'none' }}>Политика конфиденциальности</Link>
          </div>
          <div>© {new Date().getFullYear()} Royal Salmon Batumi. Все права защищены.</div>
        </div>
      </footer>
    </div>
  );
}
