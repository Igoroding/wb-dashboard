# WB Analytics Dashboard — Полная документация проекта

## Обзор проекта

Автоматизированный дашборд для отслеживания продаж и остатков на Wildberries для двух магазинов: **Одинг** и **Стольников**. Данные собираются через n8n, хранятся в Supabase PostgreSQL, отображаются на GitHub Pages.

### Архитектура
```
n8n (по расписанию 8:00)
  → WB Statistics API
  → Supabase PostgreSQL
      → GitHub Pages (дашборд читает через Supabase REST API)
```

---

## Доступы и credentials

### WB API токены
- **Одинг** (oID: 4038628):
  `Bearer eyJhbGciOiJFUzI1NiIsImtpZCI6IjIwMjUwOTA0djEiLCJ0eXAiOiJKV1QifQ.eyJhY2MiOjEsImVudCI6MSwiZXhwIjoxNzg3ODk1ODUzLCJpZCI6IjAxOWM5YjBkLTFhYzAtN2M2Ni04ZmE0LTAxYzgyOTU3ZTNjZSIsImlpZCI6MjMwOTk4ODYsIm9pZCI6NDAzODYyOCwicyI6MTA3Mzc0MTg3Miwic2lkIjoiMzY1N2IzMmMtMzQ1NC00MjFhLWE2OWItNmFmZGIxNDIzMTlmIiwidCI6ZmFsc2UsInVpZCI6MjMwOTk4ODZ9.rttnRBrfaovQHYfEx6a0w0QudsIZ2xRdu66JskIybwKvVxQLNMjXqaBlmFpKulC2RmoxuIlW2OgX6f8r1VSRnQ`
  Срок: ~июнь 2026

- **Стольников** (oID: 406043):
  `Bearer eyJhbGciOiJFUzI1NiIsImtpZCI6IjIwMjUwOTA0djEiLCJ0eXAiOiJKV1QifQ.eyJhY2MiOjEsImVudCI6MSwiZXhwIjoxNzg3OTQ1ODQyLCJpZCI6IjAxOWM5ZTA3LWUyZWEtNzEzNC1hOWU0LWUzZjM2YzFiY2U1OCIsImlpZCI6MjMwOTk4ODYsIm9pZCI6NDA2MDQzLCJzIjoxMDczNzQxODcyLCJzaWQiOiJhYmNjNzZjZS1kYzg1LTQ2NjItYjYzZi0yNjRkMjZmZWZmNjciLCJ0IjpmYWxzZSwidWlkIjoyMzA5OTg4Nn0.qDIYGXHM-58J8I9QMKgX7h_RiVYfeEwvNyDCgUAg1eQm8hGgvjVeJZ7b8RoDKJl2uw72I-7D2LKPQnMPONCsYA`
  Срок: ~июнь 2026

### Supabase
- **URL**: `https://rkxezsfrmjvriokhzaxk.supabase.co`
- **Проект**: wb-dashboard (Frankfurt)
- **Anon key** (публичный, для дашборда):
  `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJreGV6c2ZybWp2cmlva2h6YXhrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI1NTM5MTIsImV4cCI6MjA4ODEyOTkxMn0.IOMsGZh7ZGn1LTs2UCxdBWoIWH1LGiprkgR6pwpfabw`
- **Service role key** (только для n8n, не светить публично):
  `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJreGV6c2ZybWp2cmlva2h6YXhrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjU1MzkxMiwiZXhwIjoyMDg4MTI5OTEyfQ.H2SP-_ixQogUenbKKyOW0_R-YBJI0Bfc-Sp3vc_KadE`

### GitHub
- **Репозиторий**: https://github.com/Igoroding/wb-dashboard
- **GitHub Pages URL**: https://igoroding.github.io/wb-dashboard/
- **Token**: `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`

### n8n
- **URL**: https://wbtrenz.app.n8n.cloud
- **Тариф**: Trial (12 дней осталось на момент 04.03.2026, 32/1000 executions)
- **Workflow ID**: `mj21wHs4EuWJfGZA` (единый workflow со всеми цепочками)

---

## Структура базы данных (Supabase)

### Таблица `wb_orders` — ежедневная сводка заказов
```sql
CREATE TABLE wb_orders (
  id bigint generated always as identity primary key,
  shop text not null,                    -- 'oding' | 'stolnikov'
  date date not null,                    -- дата (вчера на момент запуска)
  orders integer default 0,             -- кол-во заказов
  cancelled integer default 0,          -- кол-во отмен
  revenue numeric default 0,            -- выручка в рублях
  articles integer default 0,           -- кол-во уникальных артикулов
  top_articles jsonb default '[]',       -- [[артикул, кол-во, выручка], ...]
  warehouses jsonb default '[]',         -- [[склад, кол-во], ...]
  spark_orders jsonb default '[]',       -- [int x7] данные для спарклайна заказов
  spark_revenue jsonb default '[]',      -- [int x7] данные для спарклайна выручки
  spark_days jsonb default '[]',         -- ['01 мар.', ...] подписи дней
  created_at timestamptz default now(),
  UNIQUE(shop, date)
);
```

### Таблица `wb_stocks` — ежедневные остатки по артикулам
```sql
CREATE TABLE wb_stocks (
  id bigint generated always as identity primary key,
  shop text not null,                    -- 'oding' | 'stolnikov'
  date date not null,                    -- дата снятия остатков
  article text not null,                 -- артикул товара (supplierArticle)
  quantity integer default 0,            -- кол-во на складе WB (не в пути)
  created_at timestamptz default now(),
  UNIQUE(shop, date, article)
);
```

### Row Level Security (для обеих таблиц)
```sql
ALTER TABLE wb_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read" ON wb_orders FOR SELECT USING (true);
CREATE POLICY "Service insert" ON wb_orders FOR INSERT WITH CHECK (true);
CREATE POLICY "Service update" ON wb_orders FOR UPDATE USING (true);
-- То же самое для wb_stocks
```

---

## n8n Workflows

Все workflow находятся в одном n8n workflow (ID: `mj21wHs4EuWJfGZA`) в виде нескольких независимых цепочек.

### Цепочка 1: Заказы Одинг → Supabase
**Расписание**: `0 8 * * *` (каждый день в 8:00)
**Цепочка**: Триггер1 → WB API1 (orders) → Агрегация1 → Сохранить в Supabase1

WB API endpoint: `GET https://statistics-api.wildberries.ru/api/v1/supplier/orders?dateFrom={{вчера}}`

Агрегация считает за вчерашний день: заказы, отмены, выручку, топ артикулов, склады.
Спарклайны строятся за последние 7 дней.
Upsert в Supabase: `POST /rest/v1/wb_orders?on_conflict=shop,date`

### Цепочка 2: Заказы Стольников → Supabase
**Расписание**: `10 8 * * *` (каждый день в 8:10)
Аналогично цепочке 1, но с токеном Стольников.

### Цепочка 3: Остатки Одинг → Supabase
**Расписание**: `5 8 * * *` (каждый день в 8:05)
**Цепочка**: Триггер → WB Stocks API → Агрегация → Сохранить в Supabase

WB API endpoint: `GET https://statistics-api.wildberries.ru/api/v1/supplier/stocks?dateFrom=2020-01-01`

Агрегация: суммирует `quantity` (только на складе, не в пути) по каждому артикулу.
Записывает каждый артикул отдельной строкой в `wb_stocks`.

### Цепочка 4: Остатки Стольников → Supabase
**Расписание**: `15 8 * * *` (каждый день в 8:15)
Аналогично цепочке 3.

### Важные ограничения WB API
- Rate limit: ~1 запрос в минуту **на аккаунт продавца** (не по IP)
- Оба магазина принадлежат одному аккаунту WB (uid: 23099886)
- Нельзя делать параллельные запросы — нужна пауза 5-10 мин между цепочками
- При превышении лимита ошибка: "The service is receiving too many requests from you"

---

## Файлы на GitHub Pages

### `index.html` — главный дашборд
Показывает сводку заказов за вчера: карточки с метриками, топ артикулов, склады, спарклайны.
Читает данные из Supabase через anon key (REST API).
Переключение между магазинами: Одинг / Стольников / Сравнение.

### `stocks.html` — таблица остатков
Пивот-таблица: артикулы по вертикали, даты по горизонтали.
Показывает только артикулы из `articles.txt`.
Если артикул есть в списке но нет данных — показывает 0.
Цветовая индикация: >50 (зелёный), 10-50 (жёлтый), 1-9 (оранжевый), 0 (серый), новое поступление (синий).

### `articles.txt` — список отслеживаемых артикулов
Простой текстовый файл, каждый артикул с новой строки.
Загружается динамически при открытии stocks.html.
Редактировать прямо на GitHub — изменения вступают в силу мгновенно.

---

## Supabase REST API (для дашборда)

### Получить последние заказы (оба магазина)
```
GET /rest/v1/wb_orders?select=*&order=date.desc&limit=2
Headers: apikey: <anon_key>, Authorization: Bearer <anon_key>
```

### Получить остатки по магазину
```
GET /rest/v1/wb_stocks?shop=eq.oding&order=date.asc,article.asc&limit=1000
```

### Upsert заказов (n8n)
```
POST /rest/v1/wb_orders?on_conflict=shop,date
Headers: + Prefer: resolution=merge-duplicates
```

### Upsert остатков (n8n)
```
POST /rest/v1/wb_stocks?on_conflict=shop,date,article
Headers: + Prefer: resolution=merge-duplicates
```

---

## Текущий статус (04.03.2026)

- ✅ Supabase: таблицы `wb_orders` и `wb_stocks` созданы, RLS настроен
- ✅ n8n: все 4 цепочки работают, данные пишутся корректно
- ✅ GitHub Pages: `index.html` показывает реальные данные из Supabase
- ✅ `stocks.html` создана, ожидает загрузки на GitHub
- ✅ `articles.txt` создан, ожидает загрузки на GitHub
- ⚠️ n8n триал заканчивается ~16 марта 2026 — нужно перейти на платный план или self-hosted

### Данные в базе
- `wb_orders`: записи за 03.03.2026 (Одинг: 450 заказов, 55 916 ₽; Стольников: 1078 заказов, 126 039 ₽)
- `wb_stocks`: остатки за 04.03.2026 (244 артикула Стольников, данные Одинг)

---

## Что планировалось / TODO

- [ ] Добавить ссылку на stocks.html с главного дашборда
- [ ] Когда закончится триал n8n — решить вопрос с хостингом (self-hosted или платный)
- [ ] Обновить WB токены до истечения срока (июнь 2026)
- [ ] Возможные доработки дашборда: динамика по дням, сравнение с прошлой неделей

---

## Как продолжить в новом чате

Скопируйте этот документ и передайте ИИ-ассистенту со словами:

> "Вот документация нашего проекта WB дашборд. Продолжи работу."

Все credentials, структура БД, логика workflow — всё здесь.
