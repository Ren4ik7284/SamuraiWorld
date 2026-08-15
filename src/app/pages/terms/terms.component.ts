import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
@Component({
  selector: 'app-terms',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="page" style="padding: 100px 0 60px;">
      <div class="container" style="max-width: 900px;">
        <header style="margin-bottom: 40px; text-align: center;">
          <p class="section-eyebrow" style="color: #f0c040; font-weight: 700; text-transform: uppercase; font-size: 0.85rem; letter-spacing: 1px; margin-bottom: 12px;">Документация</p>
          <h1 style="font-family: var(--font-display); font-size: 2.4rem; font-weight: 800; color: #f8fafc; margin-bottom: 12px;">Пользовательское Соглашение и Публичная Оферта</h1>
          <p style="color: #94a3b8; font-size: 0.95rem;">Дата последнего обновления: 10 августа 2026 года</p>
        </header>
        <article class="card glass-card" style="background: rgba(22, 12, 16, 0.85); border: 1px solid rgba(212, 160, 23, 0.25); padding: 36px; border-radius: 16px; color: #cbd5e1; line-height: 1.7; font-size: 0.95rem;">
          <section style="margin-bottom: 28px;">
            <h2 style="font-size: 1.3rem; color: #f8fafc; margin-bottom: 12px; font-weight: 700;">1. Общие условия и предмет оферты</h2>
            <p>Настоящее Пользовательское соглашение (далее — Оферта) является официальным предложением проекта <strong>SamuraiWorld</strong> (далее — Исполнитель) заключить договор возмездного оказания цифровых услуг и приобретения внутриигровых цифровых статусов на сервере Minecraft.</p>
            <p style="margin-top: 8px;">Оплата Пользователем любого цифрового товара или привилегии (включая VIP статус) на сайте <code>https://my-minecraft-site.vercel.app/</code> является полным и безоговорочным акцептом данной Оферты.</p>
          </section>
          <section style="margin-bottom: 28px;">
            <h2 style="font-size: 1.3rem; color: #f8fafc; margin-bottom: 12px; font-weight: 700;">2. Порядок оказания услуг и выдачи цифрового товара</h2>
            <ul style="margin-left: 20px; margin-top: 8px;">
              <li>Все внутриигровые цифровые услуги и привилегии (включая VIP статус) предоставляются в электронном виде путем автоматического начисления на указанный игровой никнейм Minecraft.</li>
              <li>Срок начисления цифрового статуса после успешной оплаты через платежный шлюз (ЮMoney) составляет от 1 секунды до 5 минут.</li>
              <li>Привилегии не предоставляют преимущества над правилами сервера. Пользователи с премиум-статусом обязаны соблюдать <a routerLink="/rules" style="color: #f0c040;">Правила сервера</a> наравне со всеми игроками.</li>
            </ul>
          </section>
          <section style="margin-bottom: 28px;">
            <h2 style="font-size: 1.3rem; color: #f8fafc; margin-bottom: 12px; font-weight: 700;">3. Оплата и порядок возврата денежных средств</h2>
            <p>Оплата услуг осуществляется через платёжный сервис ЮMoney (банковские карты, кошелёк ЮMoney).</p>
            <p style="margin-top: 8px;">В соответствии с законодательством о цифровых товарах и услугах мгновенного использования, зачисление внутриигровых цифровых услуг является окончательным. Возврат денежных средств возможен в случае технического сбоя, если цифровой товар не был фактически зачислен на никнейм игрока.</p>
          </section>
          <section style="margin-bottom: 28px;">
            <h2 style="font-size: 1.3rem; color: #f8fafc; margin-bottom: 12px; font-weight: 700;">4. Права и обязанности сторон</h2>
            <p><strong>Пользователь обязуется:</strong> указывать точный игровой никнейм при совершении оплаты и соблюдать правила проекта.</p>
            <p style="margin-top: 8px;"><strong>Исполнитель обязуется:</strong> обеспечивать бесперебойную работу игрового сервера и оказывать своевременную техническую поддержку.</p>
          </section>
          <section style="margin-bottom: 28px;">
            <h2 style="font-size: 1.3rem; color: #f8fafc; margin-bottom: 12px; font-weight: 700;">5. Контакты и техническая поддержка</h2>
            <div style="background: rgba(26, 12, 18, 0.7); padding: 16px; border-radius: 10px; margin-top: 12px; border: 1px solid rgba(255,255,255,0.08);">
              <div><svg viewBox="0 0 24 24" fill="none" stroke="#f0c040" stroke-width="3" width="10" height="10" style="margin-right:6px;display:inline-block;vertical-align:middle;"><circle cx="12" cy="12" r="6"/></svg><strong>Служба поддержки тикетов:</strong> <a routerLink="/support" style="color: #f0c040;">Перейти в тикет-систему</a></div>
              <div style="margin-top: 6px;"><svg viewBox="0 0 24 24" fill="none" stroke="#f0c040" stroke-width="3" width="10" height="10" style="margin-right:6px;display:inline-block;vertical-align:middle;"><circle cx="12" cy="12" r="6"/></svg><strong>Telegram Главного Администратора:</strong> <a href="https://t.me/Ren4ik284" target="_blank" style="color: #f0c040;">&#64;Ren4ik284</a></div>
              <div style="margin-top: 6px;"><svg viewBox="0 0 24 24" fill="none" stroke="#f0c040" stroke-width="3" width="10" height="10" style="margin-right:6px;display:inline-block;vertical-align:middle;"><circle cx="12" cy="12" r="6"/></svg><strong>Email администрации:</strong> <a href="mailto:support@samuraiworld.ru" style="color: #f0c040;">support&#64;samuraiworld.ru</a></div>
            </div>
          </section>
        </article>
      </div>
    </div>
  `
})
export class TermsComponent {}
