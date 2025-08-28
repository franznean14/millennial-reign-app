This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## User profiles and monthly records

This app includes:

- User Profile fields: first name, last name, optional middle name, age, date of baptism, privileges (multiple), and role (user/admin/superadmin).
- Monthly Records: month (YYYY-MM), hours, bible studies, and note.

The Account page (`/account`) lets authenticated users edit their profile and add/update their monthly records.

### Supabase setup

Run the SQL in `supabase-schema.sql` in your Supabase project (SQL editor) to create the tables and RLS policies.

Notes:

- Profiles are keyed by `auth.users.id`. Each user can insert/update their own profile. Admins and superadmins can read/write all profiles.
- Monthly records are unique per `(user_id, month)` and are only visible/editable by their owner (admins can read all).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
