<div align="center">

# 🎓 IIS BSUIR Schedule — Telegram Mini App (TMA)

**Точная кроссплатформенная веб-копия официального мобильного приложения «Расписание БГУИР»**  
*Работает внутри Telegram (смартфоны, планшеты, ПК) и в любом современном браузере.*

[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React 19](https://img.shields.io/badge/React_19-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vitejs.dev/)
[![Tailwind CSS v4](https://img.shields.io/badge/Tailwind_CSS_v4-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![Telegram WebApp](https://img.shields.io/badge/Telegram_Mini_App-2CA5E0?style=for-the-badge&logo=telegram&logoColor=white)](https://core.telegram.org/bots/webapps)

</div>

---

## 📱 Ключевые возможности

- 📅 **Расписание без задержек**:
  - Прямая работа с живым API ИИС БГУИР (`https://iis.bsuir.by/api/v1`) — никаких моковых данных.
  - Полноценный поиск и мгновенное переключение студенческих групп и преподавателей.
  - Фильтрация по подгруппам (1 / 2) и просмотр детальной карточки занятия (аудитории, преподаватель, примечания).
  - Учебный календарь: автоматический расчет текущей недели (1..4) с 1 сентября.
  - Интерактивный **Apple Date Rail**: прокрутка 90 дней (`-7` до `+83` дней).

- 👆 **Фирменный Apple Pull-to-Refresh**:
  - Точная физика оттягивания с пружинной анимацией Framer Motion.
  - Watchdog-таймер на 2.5 секунды (гарантирует, что индикатор обновления никогда не зависнет на экране).
  - Защита от случайных ложных срабатываний: инерция быстрого скролла снизу вверх блокируется (обновление происходит только при осознанном потягивании пальцем вниз).

- 📊 **Электронная зачётка и успеваемость**:
  - Средний балл, рейтинг группы и журнал оценок по дисциплинам семестра.

- 📝 **Заметки к занятиям**:
  - Персональные задачи и напоминания с сохранением в локальном хранилище.

- 🎨 **Кастомизация и темы**:
  - **Apple Minimal**: плавные блюры, динамические градиенты и фирменная парящая панель навигации.
  - **Cyber Techno**: терминальный моноширинный интерфейс, неоновая подсветка и ASCII-кнопки.
  - Палитра акцентных цветов: Apple Indigo, Sky Blue, Spring Green, Rose Red, Techno Neon и др.

- 💻 **Адаптивность для любых экранов**:
  - Идеально масштабируется: от компактных экранов смартфонов в Telegram до планшетов (iPad), ноутбуков и Telegram Desktop.

---

## 🛠 Быстрый старт

### 1. Клонирование репозитория
```bash
git clone https://github.com/Elate11/telegram_shedule_telegram-.git
cd telegram_shedule_telegram-
```

### 2. Установка зависимостей
```bash
npm install
```

### 3. Настройка окружения
Создайте файл `.env` на основе `.env.example`:
```bash
cp .env.example .env
```
Укажите ваш токен Telegram-бота:
```env
TELEGRAM_BOT_TOKEN=your_bot_token_here
```

### 4. Запуск в режиме разработки
```bash
npm run dev
```
Приложение откроется по адресу `http://localhost:5173`.

### 5. Сборка для продакшена
```bash
npm run build
```
Собранные статические файлы будут сохранены в папке `dist/`.

---

## 📂 Структура проекта

```text
src/
├── components/          # UI-компоненты (Pull-to-Refresh, DateRail, Карточки, Навигация)
├── screens/             # Экраны приложения (Расписание, Оценки, Заметки, Профиль)
├── services/            # Интеграции: API БГУИР, календарь, Telegram WebApp SDK
├── types/               # TypeScript-интерфейсы моделей данных
├── styles/              # Стили и дизайн-токены
├── App.tsx              # Главный контейнер с переключением экранов
└── main.tsx             # Точка входа React
```

---

## 🔒 Безопасность
Файл `.env` с секретным токеном бота добавлен в `.gitignore` и никогда не попадает в публичный репозиторий.
