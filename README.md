# 📊 WB Dashboard — Документация проекта

> Дашборд мониторинга продаж на Wildberries для двух магазинов: **Одинг** и **Стольников**.  
> Данные суммируются. Продаём семена растений, аудитория — дачники и садоводы.

---

## 🏗️ Архитектура

```
Wildberries API
      ↓
   n8n (сбор данных, ежедневно в 08:00)
      ↓
Supabase PostgreSQL (хранение)
      ↓
GitHub Pages (дашборд, статический HTML)
      ↓
Polza.ai / GPT-4o (AI-анализ по запросу)
```

---

## 🌐 Ссылки

| Сервис | URL |
|--------|-----|
| Дашборд РнП | https://wbtrenz.github.io/rnp.html |
| Дашборд Остатки | https://wbtrenz.github.io/stocks.html |
| GitHub репо | https://github.com/wbtrenz/wbtrenz.github.io |
| n8n | https://wbtrenz.app.n8n.cloud |
| Supabase | https://supabase.com/dashboard/project/rkxezsfrmjvriokhzaxk |
| Polza.ai | https://polza.ai |

---

## 📁 Файлы в репозитории

| Файл | Назначение |
|------|-----------|
| `rnp.html` | Дашборд РнП (заказы, продажи, реклама, ДРР) |
| `stocks.html` | Дашборд остатков товаров на складах WB |
| `favicon.svg` | Фавикон (зелёный график на тёмном фоне) |
| `articles.txt` | Список артикулов для фильтрации в stocks.html |
| `README.md` | Эта документация |

---

## 🗄️ Supabase

**Project ID:** `rkxezsfrmjvriokhzaxk`  
**URL:** `https://rkxezsfrmjvriokhzaxk.supabase.co`

### Ключи
- **anon key** (для дашборда, read-only): `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJreGV6c2ZybWp2cmlva2h6YXhrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI1NTM5MTIsImV4cCI6MjA4ODEyOTkxMn0.IOMsGZh7ZGn1LTs2UCxdBWoIWH1LGiprkgR6pwpfabw`
- **service_role key** (для n8n, write): `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJreGV6c2ZybWp2cmlva2h6YXhrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjU1MzkxMiwiZXhwIjoyMDg4MTI5OTEyfQ.H2SP-_ixQogUenbKKyOW0_R-YBJI0Bfc-Sp3vc_KadE`

### Таблицы

#### `wb_rnp` — заказы, продажи, реклама по дням
```sql
CREATE TABLE wb_rnp (
  date         date NOT NULL,
  shop         text NOT NULL,  -- 'oding' | 'stolnikov'
  orders_count integer DEFAULT 0,
  orders_sum   numeric DEFAULT 0,
  sales_count  integer DEFAULT 0,
  sales_sum    numeric DEFAULT 0,
  ads_spend    numeric DEFAULT 0,
  PRIMARY KEY (date, shop)
);
```

#### `wb_stocks` — остатки товаров на складах
```sql
CREATE TABLE wb_stocks (
  shop     text NOT NULL,
  date     date NOT NULL,
  article  text NOT NULL,
  quantity integer DEFAULT 0,
  PRIMARY KEY (shop, date, article)
);
```

#### `wb_plan` — план на месяц
```sql
CREATE TABLE wb_plan (
  month        text PRIMARY KEY,  -- формат 'YYYY-MM'
  orders_plan  numeric DEFAULT 0,
  sales_plan   numeric DEFAULT 0,
  drr_plan     numeric DEFAULT 10,
  updated_at   timestamptz DEFAULT now()
);
-- RLS политика:
ALTER TABLE wb_plan ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow all" ON wb_plan FOR ALL USING (true) WITH CHECK (true);
```

---

## ⚙️ n8n Workflows

**Единый workflow:** `WB AI v7` (id: `mj21wHs4EuWJfGZA`)

Содержит все триггеры в одном workflow.

### Расписание запуска (UTC, ежедневно)
| Время | Действие |
|-------|---------|
| 08:00 | Остатки Одинг |
| 08:05 | Остатки Стольников |
| 08:15 | Остатки Стольников (дубль) |
| 08:20 | Заказы + Продажи + Реклама Стольников |
| 08:00 | Заказы + Продажи + Реклама Одинг |

### Логика сбора РнП
1. Запрос заказов за 14 дней (`/api/v1/supplier/orders`)
2. Wait 1 минута (rate limit WB API)
3. Запрос продаж за 14 дней (`/api/v1/supplier/sales`) + реклама (`/adv/v1/upd`)
4. Агрегация по дням (группировка, суммирование, фильтр отмен и возвратов)
5. Upsert в Supabase (`on_conflict=date,shop`)

**Важно:** используется `priceWithDisc` (цена со скидкой) — соответствует WB Partners.

### AI-анализ (webhook)
- **Путь:** `POST /webhook/wb-ai-v7`
- **Узлы:** Webhook → Build Request (Code) → Polza.ai API → Parse Response → Respond
- **Модель:** `gpt-4o` через Polza.ai
- **Ключ Polza.ai:** `pza_HoGxwLzyc3j_nQMCweE6wf1wal9gEsH8`

---

## 🔑 Токены Wildberries

### Магазин Стольников
- **Статистика API:** `eyJhbGciOiJFUzI1NiIsImtpZCI6IjIwMjUwOTA0djEiLCJ0eXAiOiJKV1QifQ...` (exp: ~2026-04)
- **Реклама API:** `eyJhbGciOiJFUzI1NiIsImtpZCI6IjIwMjYwMzAydjEiLCJ0eXAiOiJKV1QifQ...` (exp: ~2026-04)

### Магазин Одинг  
- **Статистика API:** `eyJhbGciOiJFUzI1NiIsImtpZCI6IjIwMjUwOTA0djEiLCJ0eXAiOiJKV1QifQ...` (exp: ~2026-04)
- **Реклама API:** `eyJhbGciOiJFUzI1NiIsImtpZCI6IjIwMjYwMzAydjEiLCJ0eXAiOiJKV1QifQ...` (exp: ~2026-04)

> ⚠️ Токены хранятся прямо в n8n узлах. При истечении — обновить в WB Partners → Настройки → Токены.

---

## 📊 Дашборд rnp.html

### Функции
- Вкладки по месяцам (автоматически)
- Темп выполнения плана (нарастающим итогом vs план)
- Таблица по дням: заказы, продажи, реклама, ДРР
- График Chart.js (заказы + реклама)
- Блок AI-анализа (кнопка → webhook → GPT-4o)
- Поля плана: заказы, продажи, ДРР — сохраняются в `wb_plan`

### Логика ДРР
```
ДРР = ads_spend / orders_sum * 100%
```
Норма: ≤10% ✅ | 10–15% 🟡 | >15% 🔴

### Важные особенности
- Таблица показывает **вчерашние** данные как последние (сегодня неполные)
- Данные за 14 дней (не привязано к месяцу)
- Прогноз = текущий темп × оставшиеся дни
- % выкупа **не отображается** — данные некорректны из-за задержки WB

---

## 🤖 AI-анализ

### Что умеет
- Анализирует данные за последние 14 дней
- Знает контекст: семена, дачники, зимняя/летняя сезонность
- Форматирует числа полностью: `2 827 000 ₽`
- Выводит в HTML (рендерится в дашборде)
- Целевой ДРР берёт из плана (поле `drr_plan`)

### Чего не делает
- Не анализирует % выкупа (данные некорректны)
- Не делает выводов о трендах по дням недели при 14 днях выборки
- Не паникует от высокого ДРР за один день (может быть стратегией)

### Структура ответа
```
🔴 Тревожные сигналы
📈 Динамика  
💡 Гипотезы
✅ Позитивное
📋 План месяца
```

---

## 🔧 Типичные проблемы и решения

| Проблема | Причина | Решение |
|----------|---------|---------|
| Данные не обновляются | n8n workflow упал | Проверить Executions в n8n |
| Расхождение с WB Partners | Неверное поле цены | Убедиться что используется `priceWithDisc` |
| AI возвращает пустой ответ | Ошибка в n8n узле | Открыть последний Execution, найти упавший узел |
| Ошибка 415 от Polza.ai | Content-Type не передан | Убедиться что `specifyBody: json` в HTTP узле |
| План не сохраняется | Нет RLS политики на `wb_plan` | Выполнить SQL: `CREATE POLICY "allow all"...` |
| Rate limit WB API | Слишком частые запросы | Wait узел 1 мин между заказами и продажами |

---

## 💬 Промпт для нового чата

Если нужно продолжить работу в новом чате, вставь это в начало:

```
Мы разрабатываем дашборд для мониторинга продаж на Wildberries.

БИЗНЕС: два магазина (Одинг + Стольников), продают семена растений. 
Аудитория — дачники и садоводы. Данные суммируются по двум магазинам.

СТЕК:
- GitHub Pages: https://wbtrenz.github.io (rnp.html, stocks.html, favicon.svg)
- n8n: https://wbtrenz.app.n8n.cloud (workflow id: mj21wHs4EuWJfGZA, "WB AI v7")
- Supabase: rkxezsfrmjvriokhzaxk.supabase.co (таблицы: wb_rnp, wb_stocks, wb_plan)
- Polza.ai: GPT-4o через OpenAI-совместимый API (ключ: pza_HoGxwLzyc3j_nQMCweE6wf1wal9gEsH8)
- WB API: статистика + реклама для обоих магазинов

КЛЮЧЕВЫЕ ДЕТАЛИ:
- Цены: priceWithDisc (соответствует WB Partners)
- Сбор данных: ежедневно в 08:00, за 14 дней назад
- AI-анализ: webhook /webhook/wb-ai-v7 → GPT-4o → HTML-ответ
- % выкупа не анализируем — данные некорректны
- Полная документация: README.md в корне репозитория
```

---

*Последнее обновление: март 2026*
