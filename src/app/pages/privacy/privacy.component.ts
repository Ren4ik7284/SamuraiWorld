import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-privacy',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="page" style="padding: 100px 0 60px;">
      <div class="container" style="max-width: 900px;">
        <header style="margin-bottom: 40px; text-align: center;">
          <p class="section-eyebrow" style="color: #f0c040; font-weight: 700; text-transform: uppercase; font-size: 0.85rem; letter-spacing: 1px; margin-bottom: 12px;">Документация</p>
          <h1 style="font-family: var(--font-display); font-size: 2.4rem; font-weight: 800; color: #f8fafc; margin-bottom: 12px;">Политика Конфиденциальности</h1>
          <p style="color: #94a3b8; font-size: 0.95rem;">Дата последнего обновления: 10 августа 2026 года</p>
        </header>

        <article class="card glass-card" style="background: rgba(22, 12, 16, 0.85); border: 1px solid rgba(212, 160, 23, 0.25); padding: 36px; border-radius: 16px; color: #cbd5e1; line-height: 1.7; font-size: 0.95rem;">
          <section style="margin-bottom: 28px;">
            <h2 style="font-size: 1.3rem; color: #f8fafc; margin-bottom: 12px; font-weight: 700;">1. Общие положения</h2>
            <p>Настоящая Политика конфиденциальности персональных данных (далее — Политика) действует в отношении всей информации, которую проект <strong>SamuraiWorld</strong> (далее — Сервис), доступный по адресу <code>https://my-minecraft-site.vercel.app/</code>, может получить о Пользователе во время использования интернет-сайта и сервера Minecraft.</p>
          </section>

          <section style="margin-bottom: 28px;">
            <h2 style="font-size: 1.3rem; color: #f8fafc; margin-bottom: 12px; font-weight: 700;">2. Собираемая информация</h2>
            <p>Мы обрабатываем следующие категории персональных данных Пользователя:</p>
            <ul style="margin-left: 20px; margin-top: 8px;">
              <li>Игровой никнейм Minecraft;</li>
              <li>Адрес электронной почты (email), используемый при регистрации;</li>
              <li>IP-адрес и технические логи подключения к сайту и серверу;</li>
              <li>История покупок внутриигровых привилегий и товаров (без хранения реквизитов банковских карт).</li>
            </ul>
          </section>

          <section style="margin-bottom: 28px;">
            <h2 style="font-size: 1.3rem; color: #f8fafc; margin-bottom: 12px; font-weight: 700;">3. Цели обработки персональных данных</h2>
            <p>Персональные данные Пользователя обрабатываются в следующих целях:</p>
            <ul style="margin-left: 20px; margin-top: 8px;">
              <li>Предоставление доступа к ресурсам сайта и игровому серверу Minecraft;</li>
              <li>Автоматическое зачисление внутриигровых статусов (включая VIP статус);</li>
              <li>Обработка обращений Пользователя в службу поддержки и тикет-систему;</li>
              <li>Обеспечение безопасности игрового процесса и защита от мошенничества.</li>
            </ul>
          </section>

          <section style="margin-bottom: 28px;">
            <h2 style="font-size: 1.3rem; color: #f8fafc; margin-bottom: 12px; font-weight: 700;">4. Безопасность и защита данных</h2>
            <p>Сервис принимает необходимые организационные и технические меры для защиты персональных данных Пользователя от неправомерного или случайного доступа, уничтожения, изменения, блокирования, копирования, распространения, а также от иных неправомерных действий третьих лиц.</p>
            <p style="margin-top: 8px;">Все платежные операции проводятся через защищенные соединения авторизованными платежными агрегаторами (через шлюз RollyPay). Реквизиты банковских карт и данные платёжных средств не хранятся на серверах SamuraiWorld.</p>
          </section>

          <section style="margin-bottom: 28px;">
            <h2 style="font-size: 1.3rem; color: #f8fafc; margin-bottom: 12px; font-weight: 700;">5. Контакты службы поддержки</h2>
            <p>По всем вопросам, связанным с обработкой персональных данных и работой Сервиса, вы можете связаться со службой поддержки:</p>
            <div style="background: rgba(26, 12, 18, 0.7); padding: 16px; border-radius: 10px; margin-top: 12px; border: 1px solid rgba(255,255,255,0.08);">
              <div><svg viewBox="0 0 24 24" fill="none" stroke="#f0c040" stroke-width="3" width="10" height="10" style="margin-right:6px;display:inline-block;vertical-align:middle;"><circle cx="12" cy="12" r="6"/></svg><strong>Тикет-система:</strong> <a routerLink="/support" style="color: #f0c040;">Создать обращение</a></div>
              <div style="margin-top: 6px;"><svg viewBox="0 0 24 24" fill="none" stroke="#f0c040" stroke-width="3" width="10" height="10" style="margin-right:6px;display:inline-block;vertical-align:middle;"><circle cx="12" cy="12" r="6"/></svg><strong>Telegram Администратора:</strong> <a href="https://t.me/Ren4ik284" target="_blank" style="color: #f0c040;">&#64;Ren4ik284</a></div>
              <div style="margin-top: 6px;"><svg viewBox="0 0 24 24" fill="none" stroke="#f0c040" stroke-width="3" width="10" height="10" style="margin-right:6px;display:inline-block;vertical-align:middle;"><circle cx="12" cy="12" r="6"/></svg><strong>Email технической поддержки:</strong> <a href="mailto:support@samuraiworld.ru" style="color: #f0c040;">support&#64;samuraiworld.ru</a></div>
            </div>
          </section>
        </article>
      </div>
    </div>
  `
})
export class PrivacyComponent {}
