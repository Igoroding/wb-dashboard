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
| n8n | https://wbtrenz.app.n8n.cloud |
| Supabase | https://supabase.com/dashboard/project/rkxezsfrmjvriokhzaxk |
| Polza.ai | https://polza.ai |

---

## 📁 Файлы в репозитории

| Файл | Назначение |
|------|-----------|
| `rnp.html` | Дашборд РнП (заказы, продажи, реклама, ДРР) |
| `stocks.html` | Дашборд остатков товаров на складах WB |
| `favicon.svg` | Фавикон (зелёный график на тёмном фоне), подключён на обеих страницах |
| `articles.txt` | Список артикулов для фильтрации в stocks.html |
| `README.md` | Эта документация |

---

## 🗄️ Supabase

**Project ID:** `rkxezsfrmjvriokhzaxk`  
**URL:** `https://rkxezsfrmjvriokhzaxk.supabase.co`

### Ключи
- **anon key** (для дашборда): `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJreGV6c2ZybWp2cmlva2h6YXhrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI1NTM5MTIsImV4cCI6MjA4ODEyOTkxMn0.IOMsGZh7ZGn1LTs2UCxdBWoIWH1LGiprkgR6pwpfabw`
- **service_role key** (для n8n): `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJreGV6c2ZybWp2cmlva2h6YXhrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjU1MzkxMiwiZXhwIjoyMDg4MTI5OTEyfQ.H2SP-_ixQogUenbKKyOW0_R-YBJI0Bfc-Sp3vc_KadE`

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
-- Обязательно: RLS политика для записи через anon key
ALTER TABLE wb_plan ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow all" ON wb_plan FOR ALL USING (true) WITH CHECK (true);
```

---

## ⚙️ n8n

**Единый workflow:** `WB AI v7` (id: `mj21wHs4EuWJfGZA`)

### Расписание (UTC, ежедневно)
| Время | Действие |
|-------|---------|
| 08:00 | Остатки Одинг |
| 08:05 | Остатки Стольников |
| 08:20 | Заказы + Продажи + Реклама Стольников |
| 08:00 | Заказы + Продажи + Реклама Одинг |

### Логика сбора РнП
1. Заказы за 14 дней (`/api/v1/supplier/orders`)
2. Wait 1 мин (rate limit)
3. Продажи (`/api/v1/supplier/sales`) + Реклама (`/adv/v1/upd`)
4. Агрегация по дням, фильтр отмен (isCancel) и возвратов (saleID начинается с R)
5. Upsert в Supabase (`on_conflict=date,shop`)

**Важно:** используется `priceWithDisc` — соответствует WB Partners.

### AI webhook
- **Путь:** `POST /webhook/wb-ai-v7`
- **Узлы:** Webhook → Build Request (Code) → Polza.ai API → Parse Response → Respond
- **Модель:** `gpt-4o` через Polza.ai
- **Ключ Polza.ai:** `pza_HoGxwLzyc3j_nQMCweE6wf1wal9gEsH8`
- **HTTP узел:** `specifyBody: json`, `jsonBody: ={{ JSON.stringify($json) }}`, заголовок только `Authorization`
- **Ответ:** HTML (рендерится через `innerHTML` в дашборде)

### Актуальный код узла Build Request:
```javascript
const inp = $input.first().json;
const prompt = (inp.body && inp.body.prompt) ? String(inp.body.prompt) : 'тест';

const sys = `Ты — опытный аналитик e-commerce, специализируешься на Wildberries.

КОНТЕКСТ БИЗНЕСА:
- Магазины продают семена растений (два магазина: Одинг и Стольников, данные суммируются)
- Целевая аудитория — дачники и садоводы
- Сейчас март — зимний сезон, выходные традиционно лучше будних

ФОРМАТИРОВАНИЕ ЧИСЕЛ:
- Всегда пиши полные числа: не "2827К₽", а "2 827 000 ₽"
- Не сокращай тысячи и миллионы буквами К и М

МЕТРИКИ — ВАЖНЫЕ ПРАВИЛА:
- ДРР = реклама / заказы * 100%. Целевой ДРР берётся из строки "План на месяц" в данных (поле "ДРР X%")
- Желтая зона — превышение цели до 5 пп, красный флаг — превышение более чем на 5 пп
- Высокий ДРР на отдельные дни — НЕ красный флаг. Иногда это стратегия роста позиций. Оценивай ДРР только в среднем за 7+ дней
- Если ДРР высокий и заказы растут — это инвестиция в позиции, не проблема
- % выкупа — НЕ АНАЛИЗИРОВАТЬ, данные некорректны

ОГРАНИЧЕНИЯ ВЫБОРКИ:
- 14 дней — мало для выводов о закономерностях по дням недели, не делай обобщений

СТИЛЬ ОТВЕТА:
- Используй HTML (не Markdown): <b>жирный</b>, <br> для переноса
- Структура строго:
  <b>🔴 Тревожные сигналы</b><br>
  <b>📈 Динамика</b><br>
  <b>💡 Гипотезы</b><br>
  <b>✅ Позитивное</b><br>
  <b>📋 План месяца</b><br>
- В каждом блоке максимум 2-3 строки с конкретными цифрами
- Пиши кратко, без воды`;

return [{
  json: {
    model: "gpt-4o",
    max_tokens: 1000,
    messages: [
      { role: "system", content: sys },
      { role: "user",   content: prompt }
    ]
  }
}];
```

---

## 🔑 Токены Wildberries

Хранятся в узлах n8n. При истечении обновить в WB Partners → Настройки → Токены.

- **Стольников** (oid: 406043) — статистика + реклама
- **Одинг** (oid: 4038628) — статистика + реклама

---

## 📊 Дашборд rnp.html

### Функции
- Вкладки по месяцам (автоматически)
- Темп выполнения плана нарастающим итогом
- Таблица по дням: заказы, продажи, реклама, ДРР
- График Chart.js (заказы + реклама)
- AI-анализ: кнопка → webhook → GPT-4o → HTML блок
- План на месяц (заказы, продажи, ДРР) — сохраняется в `wb_plan`

### Ключевые детали
- AI результат: `body.innerHTML = text` (не textContent!)
- AI грузит отдельно 14 дней: `wb_rnp?date=gte.${from14}&date=lt.${today}`
- Целевой ДРР передаётся в промпт из `plan.drr_plan`
- Прогноз = текущий темп × оставшиеся дни
- Цены: `priceWithDisc`

---

## 📦 Дашборд stocks.html

### Функции
- Переключение между магазинами (Одинг / Стольников)
- Сводка: % в наличии, нулевые остатки, зона риска (<10 дней)
- Панель риска: артикулы с критическим запасом
- Таблица: артикулы × даты, цветовая индикация
- Новые поступления выделены синим
- **Кнопка «✨ AI-анализ склада»** — в шапке, всегда видна

### AI-анализ склада (как работает)
1. JS вычисляет по каждому артикулу: остаток, среднее продаж/день, дней до нуля, тренд (последние 3 дня vs предыдущие 3)
2. Формирует промпт с секциями: критические, зона риска, нулевые, тренды, замороженные
3. Отправляет на `/webhook/wb-ai-v7` (тот же что РнП)
4. Возвращает рекомендации по поставкам в HTML

### Структура ответа AI по складу
- 🚨 Срочно завезти
- 📦 Запланировать поставку
- 📈 Растущие позиции
- ❄️ Замороженный товар
- 💡 Общие рекомендации

---

## 🔧 Типичные проблемы и решения

| Проблема | Причина | Решение |
|----------|---------|---------|
| Данные не обновляются | n8n workflow упал | Проверить Executions в n8n |
| Расхождение с WB Partners | Неверное поле цены | Убедиться что используется `priceWithDisc` |
| AI возвращает пустой ответ | Ошибка в n8n узле | Открыть последний Execution, найти упавший узел |
| Ошибка 415 от Polza.ai | Content-Type не передан | `specifyBody: json` в HTTP узле (не raw) |
| Ошибка 400 от Polza.ai | Пустое тело запроса | Ключ в Code узле и HTTP узле должны совпадать |
| План не сохраняется | Нет RLS политики на `wb_plan` | Выполнить SQL CREATE POLICY (см. выше) |
| Rate limit WB API | Слишком частые запросы | Wait 1 мин между заказами и продажами |
| AI теги отображаются как текст | `textContent` вместо `innerHTML` | Заменить на `body.innerHTML = text` |

---

## 💬 Промпт для нового чата

```
Мы разрабатываем дашборд для мониторинга продаж на Wildberries.

БИЗНЕС: два магазина (Одинг + Стольников), продают семена растений.
Аудитория — дачники и садоводы. Данные суммируются по двум магазинам.

СТЕК:
- GitHub Pages: rnp.html, stocks.html, favicon.svg, articles.txt
- n8n: wbtrenz.app.n8n.cloud (workflow "WB AI v7", id: mj21wHs4EuWJfGZA)
- Supabase: rkxezsfrmjvriokhzaxk.supabase.co
  Таблицы: wb_rnp (заказы/продажи/реклама), wb_stocks (остатки), wb_plan (план на месяц)
- Polza.ai: GPT-4o через OpenAI-совместимый API
  Ключ: pza_HoGxwLzyc3j_nQMCweE6wf1wal9gEsH8
  Webhook: POST https://wbtrenz.app.n8n.cloud/webhook/wb-ai-v7
- WB API: статистика + реклама для обоих магазинов

КЛЮЧЕВЫЕ ДЕТАЛИ:
- Цены: priceWithDisc (соответствует WB Partners)
- Сбор данных: ежедневно ~08:00 UTC, за 14 дней назад
- AI ответы рендерятся через innerHTML (HTML формат, не Markdown)
- Webhook один для обоих дашбордов (РнП и Остатки)
- wb_plan требует RLS политику "allow all" для записи через anon key
- HTTP узел Polza.ai: specifyBody=json, заголовок только Authorization
- Полная документация: README.md в корне репозитория
```

---

*Последнее обновление: март 2026*
