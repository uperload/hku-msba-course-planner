# HKU MSc(BA) Course Planner

A responsive, unofficial course-planning tool for HKU MSc in Business Analytics students.

## Features

- Browse and filter AY 2026–27 courses
- Save courses and a wishlist locally
- Detect timetable conflicts within each teaching module
- Track core, elective, capstone, and AI-stream requirements
- View a module-based course calendar
- Forward and surface Moodle notices from `moodle@info.hku.hk`
- Responsive desktop and mobile experience

## Course emails

The **Course Emails** area uses a Resend inbound address because HKU accounts may not permit third-party Microsoft Entra app registration. An Outlook rule forwards matching messages to Resend, the server verifies the original sender, and accepted mail is stored in Neon. The API is protected with a private access key.

1. Create a Resend API key and note the default Resend inbound address.
2. Provision a Neon database and copy `.env.example` to `.env.local`.
3. Add the Resend key, Neon URL, inbound address, and a random course-email access key.
4. In Outlook, create a rule: sender is `moodle@info.hku.hk` → forward to the Resend inbound address.
5. Optional: register `/api/course-emails/inbound` for Resend's `email.received` webhook and add its signing secret. Without a webhook, the app still imports messages whenever the inbox is refreshed.

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
