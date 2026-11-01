# Gullak

A personal expense and budget tracker. You log income and spending, set monthly limits per category, and watch each budget fill up as a jar. It has accounts, a spending calendar, charts, a monthly summary and CSV export.

**Stack:** HTML, CSS and vanilla JavaScript on the front; PHP 8.1+ (PDO) on the back; MySQL 5.7+ or MariaDB 10.3+ for storage. There is no build step and no framework.

---

## Contents

1. [Features](#features)
2. [Project structure](#project-structure)
3. [Requirements](#requirements)
4. [Setup](#setup)
5. [Using the app](#using-the-app)
6. [How it works](#how-it-works)
7. [Database](#database)
8. [API reference](#api-reference)
9. [Configuration and customising](#configuration-and-customising)
10. [Security](#security)
11. [Deploying](#deploying)
12. [Troubleshooting](#troubleshooting)
13. [Known limits and ideas](#known-limits-and-ideas)

---

## Features

| Requirement | What you get |
|---|---|
| Authentication | Sign up, log in, log out. Passwords are hashed; the session lasts until you log out or close the browser. |
| Transactions | Add, edit and delete, with a confirmation step before deleting. Search and filter by text, type, category and period. |
| Categories | Separate income and expense categories. Ten expense and five income categories are created for every new account, and you can add your own from the transaction form. |
| Monthly budgets | A limit per expense category, shown as a liquid-filled jar that turns red and wobbles when you go over. Limits carry forward to later months until you change them. |
| Charts | Spending by category (donut), income vs spending for six months (bars), and a spending calendar that shades each day by how much was spent. |
| Monthly summary | Totals, savings rate, comparison with the previous month, biggest expense, a per-category breakdown, and CSV export. |

Extras: a quick-add box that parses text like `450 dinner with friends`, a "safe to spend today" figure, keyboard shortcuts, and automatic light and dark themes that follow your device.

---

## Project structure

```
gullak/
├── README.md
├── .gitignore
├── frontend/
│   ├── index.html            page shell and script/style links
│   ├── css/style.css         all styling, theme colours, animations
│   └── js/app.js             UI, state, rendering, and every call to the API
└── backend/
    ├── schema.sql            creates the database and four tables
    ├── .env.example          template for your database settings
    ├── .env                  your real settings (you create it, never commit it)
    ├── .htaccess             blocks direct web access to config files (Apache)
    ├── config.php            reads .env and defines the DB_* constants
    ├── bootstrap.php         PDO connection, session, JSON helpers, validation
    └── api/
        ├── auth.php          register, login, logout, current user
        ├── data.php          load everything; bulk import for sample data
        ├── transactions.php  add, edit, delete
        └── budgets.php       set or clear a monthly limit
```

---

## Requirements

- PHP 8.1 or newer with the `pdo_mysql` extension enabled
- MySQL 5.7+ or MariaDB 10.3+
- A modern browser
- Internet access in the browser for the two Google Fonts (the app still works without them, using fallback fonts)

XAMPP, WAMP, MAMP and Laragon all bundle PHP and MySQL and work fine.

---

## Setup

### 1. Create the database

From the `gullak` folder:

```bash
mysql -u root -p < backend/schema.sql
```

If you use phpMyAdmin, open the SQL tab, paste the contents of `backend/schema.sql` and run it.

### 2. Add your database settings

Copy the template and edit the copy:

```bash
cd backend
cp .env.example .env        # Windows: copy .env.example .env
```

```
DB_HOST=127.0.0.1
DB_PORT=3306
DB_NAME=gullak
DB_USER=root
DB_PASS=your_password_here
```

| Setup | Typical values |
|---|---|
| XAMPP / WAMP | user `root`, empty password, port 3306 |
| MAMP | user `root`, password `root`, port 8889 |
| Standalone MySQL | user `root` and the password you chose when installing |

Real environment variables take priority over the file, so on a server you can set `DB_*` there instead and skip `.env`.

### 3. Start the app

**PHP's built-in server** (simplest). From the `gullak` folder:

```bash
php -S localhost:8000
```

Open <http://localhost:8000/frontend/index.html>.

**XAMPP, WAMP or Apache.** Copy the whole `gullak` folder into `htdocs` (or `www`) and open `http://localhost/gullak/frontend/index.html`.

Keep `frontend/` and `backend/` side by side. The page finds the API at `../backend/api/`. If you ever move them apart, change `API_BASE` at the top of `frontend/js/app.js`.

### 4. Create an account

Click "Create an account". If the home screen is empty, press **Load sample data** to fill six months of example transactions and budgets so you can see every chart.

---

## Using the app

**Months.** The row of chips under the header switches the month. Everything on the page follows the selected month.

**Quick add.** Type into the Quick add box and press Enter.

| You type | Result |
|---|---|
| `450 dinner with friends` | Expense of ₹450, category Dining |
| `1200 uber to airport` | Expense, category Transport |
| `+85000 salary` | Income, category Salary |

The amount can be anywhere in the text. A leading `+` makes it income. The category comes from keywords (grocery, swiggy, uber, rent, netflix and so on) and falls back to Other. A preview under the box shows what will be saved, and the toast that follows has an Undo button. For a different date or category, use the full form.

**Add transaction.** The gold button opens the full form: type, amount, date, category (or a new one), note. Edit and delete buttons are on every row in the Ledger.

**Home.**
- *Safe to spend today*: what is left across your limits divided by the days left in the month. Outside the current month, or with no limits set, it shows net balance instead.
- *Jars*: one per category. Click a jar to change its limit with a slider and watch the level move.
- *Spending calendar*: darker days mean more spent. Hover for the amount, click a day to list its transactions.
- *Where it went*: hover a slice or a legend row to isolate a category.
- *Last six months*: click a month to jump to it.

**Ledger.** Every transaction with search, type, category and period filters.

**Jars.** All expense categories with their limits, including ones you haven't spent in yet.

**Month.** The summary and CSV export. Export opens a box with a **Copy CSV** button. Paste the text into a file named as shown (for example `gullak-2026-10-transactions.csv`) or straight into Excel or Google Sheets.

**Budget status colours.** Green under 80% of the limit, amber from 80% to 100%, red over 100%.

**Shortcuts.** `N` opens Add transaction. `/` jumps to Quick add. `Esc` closes any dialog.

---

## How it works

```
Browser (frontend/js/app.js)
   │  fetch() with JSON, session cookie
   ▼
PHP API (backend/api/*.php)  ──  bootstrap.php: session, validation, PDO
   │  prepared statements
   ▼
MySQL (users, categories, transactions, budgets)
```

1. On page load the app calls `auth.php?action=me`. A valid session cookie logs you straight in; otherwise the login screen shows.
2. After login, `data.php` returns your transactions, budgets and categories in one response. The app keeps them in memory and renders every view from that.
3. Each change (add, edit, delete, set a limit) goes to the server first. The in-memory copy updates only after the server accepts it, so the screen never shows something that wasn't saved. Errors appear as a message instead.
4. All calculations for the charts, jars, safe-to-spend and summary happen in the browser from that in-memory data.

**Budget carry-forward.** Limits are stored per month. A month with no limits of its own uses the most recent earlier month's set. The first time you change a limit in a month, the server copies the inherited limits into that month first, so the other categories keep their values and only the one you changed differs.

---

## Database

Four tables, all `InnoDB` with `utf8mb4`. Deleting a user removes all their rows.

| Table | Purpose | Key columns |
|---|---|---|
| `users` | Accounts | `id`, `name`, `email` (unique), `password_hash` |
| `categories` | Per-user categories | `user_id`, `type` (income or expense), `name`, `color`; unique on user + type + name |
| `transactions` | Every income or expense | `user_id`, `category_id`, `type`, `amount` DECIMAL(12,2), `txn_date`, `note` |
| `budgets` | Monthly limits | primary key (`user_id`, `period` as `YYYY-MM`, `category_id`), `amount` |

A category with transactions can't be deleted at the database level (`ON DELETE RESTRICT`). The app doesn't offer category deletion yet.

---

## API reference

Base path: `backend/api/`. Requests and responses are JSON. Every request except `GET` must send `Content-Type: application/json`. Errors return `{"error": "message"}` with an HTTP status: 400 bad input, 401 not logged in, 404 not found, 409 duplicate email, 415 wrong content type, 500 server error.

| Method | Endpoint | Body | Returns |
|---|---|---|---|
| POST | `auth.php?action=register` | `{name, email, password}` | `{user}` (201) |
| POST | `auth.php?action=login` | `{email, password}` | `{user}` |
| POST | `auth.php?action=logout` | none | `{ok}` |
| GET | `auth.php?action=me` | none | `{user}` or 401 |
| GET | `data.php` | none | `{txns, budgets, cats}` |
| POST | `data.php` | `{txns:[…], budgets:{"YYYY-MM":{Category:amount}}}` | `{ok, imported}` |
| POST | `transactions.php` | `{type, amount, date, category, note}` | `{id, cats}` |
| PUT | `transactions.php` | same fields plus `id` | `{ok, cats}` |
| DELETE | `transactions.php?id=N` | none | `{ok}` |
| PUT | `budgets.php` | `{month, category, amount}` (0 clears) | `{budgets}` |

Rules enforced by the server: amount greater than zero, date in `YYYY-MM-DD`, type is `income` or `expense`, category name up to 40 characters, note up to 80, password at least 6 characters, at most 2,000 transactions per import.

Quick test with curl (the cookie jar keeps your session):

```bash
curl -c jar.txt -H "Content-Type: application/json" \
  -d '{"name":"Test","email":"t@example.com","password":"secret1"}' \
  http://localhost:8000/backend/api/auth.php?action=register

curl -b jar.txt http://localhost:8000/backend/api/data.php
```

---

## Configuration and customising

| To change | Where |
|---|---|
| Database connection | `backend/.env` |
| Currency and number format | `MONEY` near the top of `frontend/js/app.js` (default `en-IN`, `INR`) |
| Theme colours (light and dark) | The `:root` blocks at the top of `frontend/css/style.css` |
| Category colours and the default category list | `PALETTE` and `seed_categories()` in `backend/bootstrap.php` (affects new accounts only) |
| Quick-add keywords | The `KW` object in `frontend/js/app.js` |
| API location | `API_BASE` at the top of `frontend/js/app.js` |
| Minimum password length | `auth.php` and `doAuth()` in `app.js` |

---

## Security

- Passwords are stored with `password_hash` (bcrypt by default) and checked with `password_verify`. Failed logins are slowed by 0.4 seconds each.
- Every query uses prepared statements, so SQL injection through input fields isn't possible.
- Every query filters by the logged-in user's id, so one user can't read or change another's data.
- Session cookies are `HttpOnly` and `SameSite=Lax`, are marked `Secure` over HTTPS, and get a new id at login.
- Non-GET requests must send `application/json`, which a cross-site HTML form can't do. This blocks the usual cross-site request forgery routes.
- Text is escaped before it is placed on the page, which prevents script injection through notes and category names.
- Database error details are shown only to requests from your own machine. Anyone else sees a generic message.
- `.env` is blocked from web access by `.htaccess` on Apache and is listed in `.gitignore`.

Not included: email verification, password reset, login rate limiting beyond the delay, and two-factor sign-in.

---

## Deploying

1. Use HTTPS. Without it, passwords and the session cookie travel in plain text.
2. Create a dedicated MySQL user with rights only on the `gullak` database, not `root`:
   ```sql
   CREATE USER 'gullak'@'localhost' IDENTIFIED BY 'a-strong-password';
   GRANT SELECT, INSERT, UPDATE, DELETE ON gullak.* TO 'gullak'@'localhost';
   ```
3. Put the DB settings in environment variables or `backend/.env`, and keep `.env` out of git and out of the public web root where possible.
4. On Nginx, `.htaccess` does nothing. Deny `config.php`, `bootstrap.php`, `*.sql` and `.env` with `location` rules, and route PHP through PHP-FPM.
5. Set `display_errors = Off` in `php.ini` for production. Errors still go to the server log.
6. Back up the database regularly (`mysqldump gullak > backup.sql`).

---

## Troubleshooting

When the database can't be reached, the login form shows the real MySQL message if you are running locally.

| Message contains | Cause | Fix |
|---|---|---|
| `Connection refused` or `No such file` | MySQL isn't running | Start MySQL (the Start button in XAMPP or WAMP) |
| `Unknown database 'gullak'` | Schema not imported | Run `schema.sql` (Setup step 1) |
| `Access denied for user` | Wrong user or password | Fix `DB_USER` and `DB_PASS` in `backend/.env` |
| `could not find driver` | `pdo_mysql` is off | Enable `extension=pdo_mysql` in `php.ini` and restart |
| Connection refused while MySQL runs | Different port | Set `DB_PORT` (MAMP uses 8889) |
| `Cannot reach the server` in the app | PHP isn't running, or the page was opened as a file | Open it through `http://localhost…`, not by double-clicking `index.html` |
| 404 on `../backend/api/…` | `frontend` and `backend` aren't side by side | Keep the folder layout, or change `API_BASE` |
| `.env` changes seem ignored | Cached PHP process, or a real environment variable overrides it | Restart PHP; real environment variables win over `.env` |
| Logged out immediately | Cookies blocked, or mixed HTTP and HTTPS | Allow cookies for the site and use one scheme |

---

## Known limits and ideas

- Currency is a single setting for the whole app (INR by default), with no conversion.
- Categories can be added but not renamed or deleted from the interface.
- CSV export copies to the clipboard rather than downloading a file.
- Recurring transactions, receipts, shared budgets and a password reset flow are not built.
- Good next steps: category management screen, recurring transactions, a server-side CSV download endpoint, and moving the front end to a framework once it grows.