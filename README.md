# PACE Dashboard - Full Stack Next.js Application

A comprehensive performance tracking dashboard for Testing, Review, Infrastructure, PRD, and Support (TRIPS) teams.

## 🚀 Features

- **Full-Stack Architecture**: Next.js 16 with App Router
- **Database**: SQLite with Prisma ORM
- **API Routes**: RESTful endpoints for all dashboard data
- **Server Actions**: For data mutations and updates
- **Real-time Metrics**: Track team performance, tickets, and insights
- **Modern UI**: Built with shadcn/ui, Radix UI, and Tailwind CSS
- **Charts & Visualizations**: Recharts for data visualization

## 📋 Prerequisites

- Node.js 18+ 
- npm, pnpm, or yarn

## 🛠️ Installation

1. **Clone and navigate to the project**
   ```bash
   cd FZYo9xrnLyU-1772671014901
   ```

2. **Install dependencies**
   ```bash
   npm install
   # or
   pnpm install
   # or
   yarn install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env.local
   ```

4. **Initialize the database**
   ```bash
   # Generate Prisma Client
   npm run db:generate
   
   # Push schema to database
   npm run db:push
   
   # Seed the database with sample data
   npm run db:seed
   ```

5. **Start the development server**
   ```bash
   npm run dev
   ```

6. **Open your browser**
   Navigate to [http://localhost:3000](http://localhost:3000)

## 📁 Project Structure

```
├── app/
│   ├── api/                    # API routes
│   │   ├── dashboard/          # Dashboard data endpoints
│   │   │   ├── qa/
│   │   │   ├── documentation/
│   │   │   └── code-review/
│   │   └── chart/              # Chart data endpoints
│   ├── actions/                # Server actions
│   │   ├── tickets.ts
│   │   └── team-members.ts
│   ├── layout.tsx
│   └── page.tsx
├── components/                 # React components
│   ├── ui/                     # shadcn/ui components
│   ├── pace-dashboard.tsx
│   └── ...
├── lib/
│   ├── db.ts                   # Prisma client
│   ├── dashboard-data.ts       # Static data (for reference)
│   ├── chart-data.ts           # Chart data generation
│   └── utils.ts
├── prisma/
│   ├── schema.prisma           # Database schema
│   └── seed.ts                 # Database seeding script
└── public/                     # Static assets
```

## 🔌 API Endpoints

### Dashboard Data
- `GET /api/dashboard/qa` - QA dashboard metrics and data
- `GET /api/dashboard/documentation` - Documentation dashboard data
- `GET /api/dashboard/code-review` - Code review dashboard data

### Chart Data
- `GET /api/chart/[dashboardType]?member=<name>` - Time-series chart data

## 🗄️ Database Schema

The application uses SQLite with Prisma ORM. Key models:

- **Ticket**: Critical and aging tickets
- **TeamMember**: Team member performance data
- **Activity**: Individual team member activities
- **Metrics**: Dashboard snapshot metrics
- **AIInsight**: AI-generated insights
- **EscapedBug**: Bug tracking data

## 🔧 Available Scripts

```bash
# Development
npm run dev              # Start development server

# Production
npm run build            # Build for production
npm start                # Start production server

# Database
npm run db:generate      # Generate Prisma Client
npm run db:push          # Push schema to database
npm run db:seed          # Seed database with sample data
npm run db:studio        # Open Prisma Studio (database GUI)

# Linting
npm run lint             # Run ESLint
```

## 🎨 Tech Stack

### Frontend
- **Framework**: Next.js 16 (App Router)
- **UI Library**: React 19
- **Styling**: Tailwind CSS 4
- **Components**: shadcn/ui + Radix UI
- **Charts**: Recharts
- **Icons**: Lucide React

### Backend
- **Runtime**: Node.js
- **Database**: SQLite
- **ORM**: Prisma
- **API**: Next.js API Routes + Server Actions

### Development
- **Language**: TypeScript
- **Package Manager**: npm/pnpm/yarn
- **Linting**: ESLint

## 📊 Dashboard Features

### TRIPS Summary
- Overview of all teams (Testing, Review, Infrastructure, PRD, Support)
- Comparative metrics across teams

### Team Dashboards (QA, Documentation, Code Review)
- **Team Metrics**: SP Throughput, PACE, Volume, Cycle Times
- **Individual Metrics**: Per-member performance breakdown
- **Issues**: Critical tickets and aging tickets with filters
- **AI Insights**: Automated recommendations and alerts
- **Escaped Bugs**: Quality tracking (QA only)

### Data Visualization
- Time-series charts with multiple metrics
- Daily/Weekly/Monthly aggregations
- Member-specific filtering

## 🔐 Environment Variables

```env
DATABASE_URL="file:./dev.db"
```

## 🚢 Deployment

### Vercel (Recommended)
1. Push your code to GitHub
2. Import project in Vercel
3. Add environment variables
4. Deploy

**Note**: For production, consider using PostgreSQL instead of SQLite:
- Update `DATABASE_URL` in `.env`
- Change `provider` in `prisma/schema.prisma` to `postgresql`
- Run migrations: `npx prisma migrate dev`

### Other Platforms
The app can be deployed to any platform that supports Next.js:
- Netlify
- Railway
- Render
- AWS Amplify

## 🛠️ Development Tips

### Prisma Studio
View and edit your database with a GUI:
```bash
npm run db:studio
```

### Reset Database
```bash
# Delete database and recreate
rm prisma/dev.db
npm run db:push
npm run db:seed
```

### Add New Models
1. Edit `prisma/schema.prisma`
2. Run `npm run db:push`
3. Run `npm run db:generate`

## 📝 License

Private project - All rights reserved

## 🤝 Contributing

This is a private dashboard application. For questions or issues, contact the development team.

---

Built with ❤️ using Next.js, Prisma, and shadcn/ui
