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
Polza.ai / Claude Sonnet (AI-анализ по запросу)
```

**warehouses.html** работает иначе — без n8n:
```
Браузер → WB common-api (напрямую, два параллельных запроса)
```

---

## 🌐 Ссылки

| Сервис | URL |
|--------|-----|
| Дашборд | https://igoroding.github.io/wb-dashboard/ |
| n8n | https://wbtrenz.app.n8n.cloud |
| Supabase | https://supabase.com/dashboard/project/rkxezsfrmjvriokhzaxk |
| Polza.ai | https://polza.ai |

---

## 📁 Файлы в репозитории

| Файл | Назначение |
|------|-----------|
| `rnp.html` | Дашборд РнП (заказы, продажи, реклама, ДРР) |
| `stocks.html` | Дашборд остатков товаров на складах WB |
| `warehouses.html` | Дашборд складов WB (коэффициенты приёмки, логистика) |
| `header.js` | Общая шапка и навигация для всех страниц |
| `favicon.svg` | Фавикон (зелёный график на тёмном фоне) |
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

**Единый workflow:** `WB Warehouses Webhook` (id: `mj21wHs4EuWJfGZA`)

### Расписание (UTC, ежедневно)
| Время | Действие |
|-------|---------|
| 08:00 | Остатки Стольников |
| 08:05 | Остатки Одинг |
| каждый час :00 | Заказы + Продажи + Реклама Стольников |
| каждый час :30 | Заказы + Продажи + Реклама Одинг |

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
- **Модель:** `claude-sonnet-4.6` через Polza.ai (`api.polza.ai/v1`)
- **Ключ Polza.ai:** `pza_HoGxwLzyc3j_nQMCweE6wf1wal9gEsH8`
- **HTTP узел:** `specifyBody: json`, `jsonBody: ={{ JSON.stringify($json) }}`, заголовок только `Authorization`
- **Ответ:** HTML (рендерится через `innerHTML` в дашборде)

---

## 🔑 Токены Wildberries

Хранятся в узлах n8n и напрямую в `warehouses.html`. При истечении обновить в WB Partners → Настройки → Токены.

- **Стольников** (oid: 406043) — статистика + реклама
- **Одинг** (oid: 4038628) — статистика + реклама

**Токен Одинг** (используется в warehouses.html для WB common-api):
```
eyJhbGciOiJFUzI1NiIsImtpZCI6IjIwMjUwOTA0djEiLCJ0eXAiOiJKV1QifQ...
```
Срок: до ~май 2026. При истечении заменить в `warehouses.html` константу `WB_TOKEN`.

---

## 📊 Дашборд rnp.html

### Функции
- Вкладки по месяцам (автоматически)
- Темп выполнения плана нарастающим итогом
- Таблица по дням: заказы, продажи, реклама, ДРР
- График Chart.js (заказы + реклама)
- AI-анализ: кнопка → webhook → Claude Sonnet → HTML блок
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

---

## 🏭 Дашборд warehouses.html

### Архитектура
Браузер обращается к WB API **напрямую** (без n8n), два параллельных запроса:
- `GET common-api.wildberries.ru/api/tariffs/v1/acceptance/coefficients` — коэффициенты приёмки на 14 дней
- `GET common-api.wildberries.ru/api/v1/tariffs/box?date=YYYY-MM-DD` — тарифы логистики и хранения

### Функции
- 14-дневный тепловой календарь по каждому складу (зелёный → красный)
- Сводные карточки: всего складов, доступны сегодня, бесплатная приёмка
- Фильтры: макс. коэффициент приёмки (Все / ≤5 / ≤3 / ≤1 / Бесплатно)
- Фильтр по типу поставки (Все / Склады / СЦ)
- Фильтр по типу упаковки (Короб / Монопаллет / Суперсейф QR / ...)
- **Фильтр по логистике** (≤ 125% / ≤ 110% / ≤ 100%) — по умолчанию ≤ 125%
- Скрываются склады без слотов и «Маркетплейс:...» (зарубежные)
- Колонки таблицы: Склад | 14 дней | Мин. коэф | Логистика% | Хранение%

### Цветовая индикация логистики
| Цвет | Значение |
|------|---------|
| 🟢 Зелёный | ≤ 125% |
| 🟡 Жёлтый | 126–150% |
| 🔴 Красный | > 150% |

### Источники данных для логистики
1. `boxDeliveryCoefExpr` из box tariffs API — основной источник
2. `deliveryCoef` из acceptance API — резервный

### Важно
- Токен хранится прямо в JS-коде (`WB_TOKEN`). При ротации токена обновить в файле.
- Склады типа «Короб» не имеют данных в acceptance API — отображаются на основе box tariffs.
- `boxTypeID=1` (Короб) выбирается по умолчанию; если отсутствует в ответе — выбирается первый доступный тип.

---

## 🧩 header.js — общая шапка

Подключается на всех страницах: `<script src="header.js" defer></script>`  
**defer обязателен** — иначе скрипт выполнится до `<body>` и шапка не вставится.

Вкладки навигации:
| Вкладка | Файл | Иконка |
|---------|------|--------|
| РнП | rnp.html | 📈 |
| Остатки | stocks.html | 📦 |
| Склады | warehouses.html | 🏭 |
| Сводка | summary.html | 📊 |

---

## 🔧 Типичные проблемы и решения

| Проблема | Причина | Решение |
|----------|---------|---------|
| Данные не обновляются | n8n workflow упал | Проверить Executions в n8n |
| Расхождение с WB Partners | Неверное поле цены | Убедиться что используется `priceWithDisc` |
| AI возвращает пустой ответ | Ошибка в n8n узле | Открыть последний Execution, найти упавший узел |
| Ошибка 415 от Polza.ai | Content-Type не передан | `specifyBody: json` в HTTP узле (не raw) |
| План не сохраняется | Нет RLS политики на `wb_plan` | Выполнить SQL CREATE POLICY (см. выше) |
| Rate limit WB API | Слишком частые запросы | Wait 1 мин между заказами и продажами |
| AI теги отображаются как текст | `textContent` вместо `innerHTML` | Заменить на `body.innerHTML = text` |
| warehouses.html: склады не отображаются | Токен WB истёк | Обновить `WB_TOKEN` в warehouses.html |
| warehouses.html: нет Короба в фильтре | Acceptance API не возвращает boxTypeID=1 | Норма — короба берутся из box tariffs API |
| Шапка header.js не вставляется | Отсутствует атрибут `defer` | `<script src="header.js" defer></script>` |

---

## 💬 Промпт для нового чата

```
Мы разрабатываем дашборд для мониторинга продаж на Wildberries.

БИЗНЕС: два магазина (Одинг + Стольников), продают семена растений.
Аудитория — дачники и садоводы. Данные суммируются по двум магазинам.

СТЕК:
- GitHub Pages: rnp.html, stocks.html, warehouses.html, header.js, favicon.svg, articles.txt
- n8n: wbtrenz.app.n8n.cloud (workflow "WB Warehouses Webhook", id: mj21wHs4EuWJfGZA)
- Supabase: rkxezsfrmjvriokhzaxk.supabase.co
  Таблицы: wb_rnp (заказы/продажи/реклама), wb_stocks (остатки), wb_plan (план на месяц)
- Polza.ai: Claude Sonnet через OpenAI-совместимый API
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
- warehouses.html: прямые запросы к WB common-api из браузера (без n8n)
  Токен Одинг в константе WB_TOKEN, срок ~май 2026
- header.js: общая шапка, подключать с атрибутом defer
- Полная документация: README.md в корне репозитория
```

---

*Последнее обновление: март 2026*
