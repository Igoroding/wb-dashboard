# 📊 WB Dashboard — Документация проекта

> Дашборд мониторинга продаж на Wildberries для двух магазинов: **Одинг** и **Стольников**.  
> Данные суммируются. Продаём семена растений, аудитория — дачники и садоводы.

---

## 🏗️ Архитектура

```
Wildberries API
      ↓
   n8n (сбор данных, каждый час)
      ↓
Supabase PostgreSQL (хранение)
      ↓
GitHub Pages (дашборд, статический HTML)
      ↓
Polza.ai / claude-sonnet-4-6 (AI-анализ по запросу)
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

## 📓 Дневник действий (wb_journal)

Блок в `rnp.html` — записи о внутренних событиях: новые РК, смена креативов, акции и т.д.  
Записи за последние 14 дней автоматически передаются в AI-анализ вместе с данными.

```sql
CREATE TABLE wb_journal (
  id         bigserial PRIMARY KEY,
  date       date NOT NULL DEFAULT current_date,
  note       text NOT NULL,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE wb_journal ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow all" ON wb_journal FOR ALL USING (true) WITH CHECK (true);
```

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

#### `wb_journal` — дневник действий
```sql
CREATE TABLE wb_journal (
  id         bigserial PRIMARY KEY,
  date       date NOT NULL DEFAULT current_date,
  note       text NOT NULL,
  created_at timestamptz DEFAULT now()
);
-- RLS политика аналогична wb_plan
```

---

**Единый workflow:** `WB AI v7` (id: `mj21wHs4EuWJfGZA`)

### Расписание

#### Остатки (ежедневно)
| Время UTC | Действие |
|-----------|---------|
| 08:05 | Остатки Одинг |
| 08:15 | Остатки Стольников |

#### РнП — Заказы + Продажи + Реклама (каждый час)
| Триггер | Время | Магазин |
|---------|-------|---------|
| Триггер6 | каждый час в **:00** | Стольников |
| Триггер7 | каждый час в **:30** | Одинг |

### Логика сбора РнП
1. Заказы за 14 дней + сегодня (`/api/v1/supplier/orders`)
2. Wait 1 мин (rate limit)
3. Продажи (`/api/v1/supplier/sales`) + Реклама (`/adv/v1/upd`)
4. Агрегация по дням, фильтр отмен (isCancel) и возвратов (saleID начинается с R)
5. Upsert в Supabase (`on_conflict=date,shop`)

**Важно:**
- Используется `priceWithDisc` — соответствует WB Partners
- Диапазон дат: `i = 0..13` (включая сегодня)
- Реклама: `to = $now` (включая сегодняшний день)

### Токены Wildberries
- **Стольников** (oid: 406043) — статистика + реклама (отдельные токены)
- **Одинг** (oid: 4038628) — статистика + реклама (отдельные токены)

> ⚠️ **Важно:** для рекламного API (`/adv/v1/upd`) нужен отдельный токен с правами на **Рекламу** (бит `s=64`). Токен статистики не подходит — вернёт 401 Authorization failed.

### AI webhook
- **Путь:** `POST /webhook/wb-ai-v7`
- **Узлы:** Webhook → Build Request (Code) → Polza.ai API → Parse Response → Respond
- **Модель:** `anthropic/claude-sonnet-4.6` через Polza.ai
- **Ключ Polza.ai:** `pza_HoGxwLzyc3j_nQMCweE6wf1wal9gEsH8`
- **HTTP узел:** `specifyBody: json`, `jsonBody: ={{ JSON.stringify($json) }}`, заголовок только `Authorization`
- **Ответ:** HTML (рендерится через `innerHTML` в дашборде)

### Актуальный код узла Build Request1:

> ⚠️ **Multi-turn**: дашборд теперь отправляет `messages` (массив истории), а не `prompt` (строку).
> Системный промпт добавляется в n8n — дашборд присылает только user/assistant сообщения.

```javascript
const inp = $input.first().json;
// Multi-turn: дашборд присылает messages[], мы добавляем system в начало
const incomingMessages = (inp.body && Array.isArray(inp.body.messages))
  ? inp.body.messages
  : [{ role: 'user', content: (inp.body && inp.body.prompt) ? String(inp.body.prompt) : 'тест' }];

const sys = `Ты — аналитик e-commerce. Твоя главная задача — помочь выйти на план продаж.

ЗАПРЕЩЕНО КАТЕГОРИЧЕСКИ:
- Показывать промежуточные расчёты, формулы, арифметику в ответе
- Писать "сначала посчитаю", "вычислим" и любые подобные фразы
Все расчёты делай внутри, в ответе — только выводы и цифры.

КОНТЕКСТ:
- Продаём семена растений (Одинг + Стольников, данные суммируются)
- Аудитория — дачники и садоводы, март — начало сезона
- Выходные традиционно лучше будних

ФОРМАТИРОВАНИЕ: полные числа — не "2827К₽", а "2 827 000 ₽". Никаких К и М.

ПРАВИЛА ДРР:
- Анализируй ТОЛЬКО как среднее за 7+ дней, не по отдельным дням
- Тревога = среднее превышает цель более чем на 5 пп
- Если ДРР в норме — пиши в ✅ Позитивное, не в тревоги
- % выкупа — не анализировать

ОСТАТКИ (если переданы):
- Нулевые остатки у активных артикулов — красный флаг: нет товара = нет продаж
- Критически мало (≤20 шт) — предупреждение, особенно если артикул продаётся активно
- Связывай дефицит остатков с просадками в заказах если это прослеживается
- Если остатки в норме — не упоминай их в тревогах

ДНЕВНИК ДЕЙСТВИЙ (если передан):
- Связывай записи из дневника с изменениями в метриках

ГЛАВНЫЙ БЛОК — ПЛАН МЕСЯЦА:
Если ИДЁМ (темп ≥ 95%): ✅ Идём на [X]% плана. Факт [сумма] из [план]. Нужно [N] ₽/день, темп [M] ₽/день.
Если НЕ ИДЁМ (темп < 95%):
⚠️ Не выходим на план ([X]%). Факт [сумма] из [план].
Нужно [N] ₽/день — сейчас [M] ₽/день, дефицит [D] ₽/день.
Почему: [1-2 причины из данных]
Что сделать: [1-2 конкретных действия]

При уточняющих вопросах (follow-up) — отвечай кратко, в том же HTML-стиле.
Для первого анализа используй структуру с блоками 🔴📈📋💡.
Для ответов на вопросы — свободный формат, но тоже HTML (не Markdown).`;

return [{
  json: {
    model: "anthropic/claude-sonnet-4.6",
    max_tokens: 1000,
    messages: [
      { role: "system", content: sys },
      ...incomingMessages
    ]
  }
}];
```
---

## 🔑 Токены Wildberries

Хранятся в узлах n8n. При истечении обновить в WB Partners → Настройки → Токены.

- **Стольников** (oid: 406043) — нужны два токена: статистика и реклама
- **Одинг** (oid: 4038628) — нужны два токена: статистика и реклама

> Токен рекламы должен иметь право **"Продвижение"** (бит `s` содержит `64`). Без этого `/adv/v1/upd` вернёт 401.

---

## 📊 Дашборд rnp.html

### Функции
- Вкладки по месяцам (автоматически)
- Темп выполнения плана нарастающим итогом
- Таблица по дням: заказы, продажи, реклама, ДРР
  - Сегодняшний день отображается с плашкой «сегодня»
  - График строится без сегодняшнего дня (данные неполные)
- График Chart.js (заказы + реклама)
- **📓 Дневник действий** — блок для записей о внутренних событиях (РК, акции, креативы)
- AI-анализ: кнопка → webhook → claude-sonnet-4.6 → HTML блок
  - В промпт передаются: данные РнП за 14 дней + остатки (последний день) + дневник за 14 дней
- План на месяц (заказы, продажи, ДРР) — сохраняется в `wb_plan`

### Ключевые детали
- AI результат: `body.innerHTML = text` (не textContent!)
- Факт и темп считаются только по **завершённым дням** (`date < today`) — сегодня исключён из расчётов
- Большая цифра факта — всегда белая (нейтральная); прогресс-бар и `% выполнено` окрашены по темпу
- AI грузит 14 дней завершённых дней: `wb_rnp?date=gte.${from14}&date=lt.${today}`
- Журнал за последние 14 дней передаётся в промпт автоматически при запуске анализа
- Журнал за последние 14 дней передаётся в промпт автоматически при запуске анализа
- Остатки (последний день из `wb_stocks`) передаются в промпт: нули, критические ≤20 шт, счётчик нормы
- `journalOpen` и `journalEntries` объявлены глобально в начале скрипта рядом с `let plan` — иначе `keydown` вызывает ошибку Temporal Dead Zone
- Целевой ДРР передаётся в промпт из `plan.drr_plan`
- Прогноз = среднедневной темп × общее количество дней в месяце
- Цвет темпа: зелёный ≥ 95%, жёлтый 70–95%, красный < 70%
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

## 🔧 Типичные проблемы и решения

| Проблема | Причина | Решение |
|----------|---------|---------|
| Данные не обновляются | n8n workflow упал | Проверить Executions в n8n |
| Реклама = 0 для магазина | Неверный токен (статистика вместо рекламного) | Создать отдельный токен с правом "Продвижение" |
| Расхождение с WB Partners | Неверное поле цены | Убедиться что используется `priceWithDisc` |
| AI возвращает пустой ответ | Ошибка в n8n узле | Открыть последний Execution, найти упавший узел |
| Ошибка 415 от Polza.ai | Content-Type не передан | `specifyBody: json` в HTTP узле (не raw) |
| Ошибка 401 от рекламного API | Токен без прав на рекламу | Создать токен с правом "Продвижение" в WB Partners |
| План не сохраняется | Нет RLS политики на `wb_plan` | Выполнить SQL CREATE POLICY (см. выше) |
| Cannot access 'journalEntries' before initialization | `let journalEntries` объявлен в середине скрипта, keydown срабатывает раньше | Перенести объявления `journalOpen` и `journalEntries` в начало скрипта рядом с `let plan` |
| Большая цифра красная при зелёном прогнозе | Цвет был по % выполнения, не по темпу | Исправлено: цвет по темпу, факт всегда белый |
| Темп завышен из-за сегодняшнего дня | Неполный день включался в среднее | Исправлено: факт считается только по `date < today` |
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
  Таблицы: wb_rnp (заказы/продажи/реклама), wb_stocks (остатки),
           wb_plan (план на месяц), wb_journal (дневник действий)
- Polza.ai: anthropic/claude-sonnet-4.6 через OpenAI-совместимый API
  Ключ: pza_HoGxwLzyc3j_nQMCweE6wf1wal9gEsH8
  Webhook: POST https://wbtrenz.app.n8n.cloud/webhook/wb-ai-v7
- WB API: статистика + реклама для обоих магазинов (отдельные токены!)

КЛЮЧЕВЫЕ ДЕТАЛИ:
- Цены: priceWithDisc (соответствует WB Partners)
- Сбор данных: каждый час (Стольников в :00, Одинг в :30)
- Диапазон: 14 дней + сегодня (i=0..13)
- Реклама: to=$now (включая сегодня)
- Токен рекламы ОТДЕЛЬНЫЙ от токена статистики (право "Продвижение")
- AI ответы рендерятся через innerHTML (HTML формат, не Markdown)
- Webhook один для обоих дашбордов (РнП и Остатки)
- wb_plan и wb_journal требуют RLS политику "allow all" для записи через anon key
- HTTP узел Polza.ai: specifyBody=json, заголовок только Authorization
- Факт и темп считаются только по завершённым дням (date < today)
- Большая цифра факта — белая; цвет прогресс-бара и % — по темпу (≥95% зелёный, 70-95% жёлтый, <70% красный)
- Дневник действий (wb_journal): записи за 14 дней передаются в AI-анализ автоматически
- В таблице rnp.html сегодня отображается (плашка "сегодня"), на графике — нет
- Полная документация: README.md в корне репозитория
```

---

*Последнее обновление: март 2026 (v2)*
