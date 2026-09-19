# HKU MSc(BA) Course Planner

A responsive, unofficial course-planning tool for HKU MSc in Business Analytics students.

## Features

- Browse and filter AY 2026–27 courses
- Save courses and a wishlist locally
- Detect timetable conflicts within each teaching module
- Track core, elective, capstone, and AI-stream requirements
- View a module-based course calendar
- Connect Outlook and surface Moodle notices from `moodle@info.hku.hk`
- Responsive desktop and mobile experience

## Outlook course emails

The **Course Emails** area uses delegated Microsoft Graph access. Users sign in on Microsoft's page, and the app requests read-only `Mail.Read` access. Access and refresh tokens are encrypted in `HttpOnly` cookies and are never exposed to client-side JavaScript.

1. Create a Microsoft Entra app registration for organizational accounts.
2. Add the Web redirect URIs:
   - `http://localhost:3000/api/outlook/callback`
   - `https://hku-msba-course-planner.vercel.app/api/outlook/callback`
3. Add the delegated Microsoft Graph permissions `User.Read` and `Mail.Read`.
4. Copy `.env.example` to `.env.local` and add the client ID, client secret, and a random session secret.
5. Add the same variables to the Vercel project for production.

Set `MICROSOFT_TENANT_ID` to HKU's tenant ID if sign-in should be restricted to HKU accounts. Otherwise, the default `organizations` value allows any Microsoft work or school account.

## Run locally

```bash
pnpm install
pnpm dev
```

## Build

```bash
pnpm build
```

This project is an unofficial planning aid. Always verify course information and programme requirements with official HKU communications.
