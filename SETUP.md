# Quick Setup Guide

## 🚀 Get Started in 5 Minutes

### Step 1: Install Dependencies
```bash
npm install
```

### Step 2: Set Up Database
```bash
# Generate Prisma Client
npm run db:generate

# Create database and tables
npm run db:push

# Seed with sample data
npm run db:seed
```

### Step 3: Start Development Server
```bash
npm run dev
```

### Step 4: Open Browser
Navigate to [http://localhost:3000](http://localhost:3000)

---

## 🔧 Troubleshooting

### Prisma Client Not Found
If you see `Cannot find module '@prisma/client'`:
```bash
npm run db:generate
```

### Database Issues
Reset the database:
```bash
# Windows PowerShell
Remove-Item prisma\dev.db -ErrorAction SilentlyContinue
npm run db:push
npm run db:seed

# Unix/Mac
rm prisma/dev.db
npm run db:push
npm run db:seed
```

### Port Already in Use
Change the port:
```bash
# Windows PowerShell
$env:PORT=3001; npm run dev

# Unix/Mac
PORT=3001 npm run dev
```

---

## 📊 Database Management

### View Database with Prisma Studio
```bash
npm run db:studio
```
Opens a GUI at [http://localhost:5555](http://localhost:5555)

### Update Schema
1. Edit `prisma/schema.prisma`
2. Run `npm run db:push`
3. Run `npm run db:generate`

---

## 🌐 API Endpoints

Test the API:

```bash
# Health check
curl http://localhost:3000/api/health

# Get QA dashboard data
curl http://localhost:3000/api/dashboard/qa

# Get tickets
curl http://localhost:3000/api/tickets?dashboardType=qa

# Get team members
curl http://localhost:3000/api/team-members?dashboardType=qa

# Get chart data
curl http://localhost:3000/api/chart/qa?member=all
```

---

## 📦 Production Deployment

### Vercel (Recommended)
1. Push to GitHub
2. Import in Vercel
3. Set environment variable: `DATABASE_URL`
4. Deploy

**Important**: Use PostgreSQL for production:
```env
DATABASE_URL="postgresql://user:password@host:5432/database"
```

Update `prisma/schema.prisma`:
```prisma
datasource db {
  provider = "postgresql"  // changed from sqlite
  url      = env("DATABASE_URL")
}
```

Then run:
```bash
npx prisma migrate dev --name init
npm run db:seed
```

---

## 🎯 Next Steps

1. **Customize Data**: Edit `lib/dashboard-data.ts` and re-seed
2. **Add Authentication**: Implement NextAuth.js or Clerk
3. **Real-time Updates**: Add WebSocket support
4. **Analytics**: Integrate Vercel Analytics (already included)
5. **Monitoring**: Add error tracking (Sentry, LogRocket)

---

## 📚 Learn More

- [Next.js Documentation](https://nextjs.org/docs)
- [Prisma Documentation](https://www.prisma.io/docs)
- [shadcn/ui Components](https://ui.shadcn.com)
- [Tailwind CSS](https://tailwindcss.com/docs)
