# Millennial Reign App

A modern Kingdom Ministry application built with Next.js 15, React 19, and Supabase. This PWA (Progressive Web App) provides tools for congregation management, field service tracking, and business territory management.

## 🚀 Features

### Core Functionality
- **User Management**: Profile management with roles (user/admin/superadmin)
- **Contact Information**: Phone numbers, addresses, and GPS coordinates for emergency contact
- **Monthly Records**: Track hours, bible studies, and notes
- **Congregation Management**: Add users, manage groups, and track activities
- **Field Service**: Territory management and visit tracking
- **Business Territory**: Establishment and householder management with interactive maps
- **Push Notifications**: Real-time updates and assignments
- **Privacy Policy**: Comprehensive privacy protection and data handling

### Technical Features
- **PWA Support**: Offline-ready with service worker caching
- **Real-time Updates**: Live data synchronization across views
- **Interactive Maps**: Leaflet-based mapping with clustering and smooth animations
- **Responsive Design**: Mobile-first with dark theme
- **Biometric Security**: Optional biometric authentication
- **Offline-First**: Works without internet connection
- **Offline-Ready Navigation**: All navigation components work offline with cached permissions
- **Offline-Ready BWI View**: Complete business witnessing functionality works offline
- **Smart Forms**: Change detection, intelligent save buttons, and sectioned organization
- **Geolocation**: GPS coordinates and "Get Directions" functionality
- **Vercel Speed Insights**: Performance monitoring and optimization
- **Smooth Animations**: CSS keyframe animations for map markers
- **Real-time Search**: Instant filtering across all views
- **Map Search**: Search functionality in map view with live updates
- **BWI Visit History**: Timeline view of business witnessing visits with clickable navigation
- **Smart Back Navigation**: SPA navigation stack for seamless user experience
- **Visit History Distinction**: Proper separation between establishment and householder visits
- **Establishment Badges**: Subtle badges showing establishment context for householder visits
- **Truncated Descriptions**: One-line descriptions in summary, full details in drawer
- **Dynamic Navigation Stack**: Tracks current section for proper back button behavior
- **Visit Updates Timeline**: Timeline design for establishment and householder visit updates
- **Context-Aware Badges**: Smart badge display showing establishment names in householder context and householder names in establishment context
- **Complete Status Options**: All establishment status options including "For Replenishment"
- **Offline-First Home Page**: Cached data display with offline indicators and graceful degradation
- **Clean Mobile Navigation**: Removed extra bottom padding for better mobile UX

## 🛠️ Tech Stack

### Frontend
- **Next.js 15.5.4** - React framework with App Router
- **React 19.2.0** - Latest React with concurrent features
- **TypeScript 5.9.3** - Type-safe development
- **Tailwind CSS 4.1.14** - Utility-first styling
- **Shadcn/ui** - Modern component library
- **Motion** - Smooth animations and transitions

### Backend & Database
- **Supabase 2.75.0** - Backend-as-a-Service
- **PostgreSQL** - Database with Row Level Security (RLS)
- **Real-time subscriptions** - Live data updates

### Maps & Location
- **Leaflet** - Interactive maps
- **React-Leaflet** - React integration
- **Marker Clustering** - Performance optimization
- **Geolocation API** - User location tracking

### PWA & Offline
- **Service Worker** - Offline caching
- **IndexedDB** - Local data storage
- **Background Sync** - Data synchronization
- **Web App Manifest** - App-like experience

## 📱 App Structure

### Navigation
- **Home**: Dashboard with summaries and top studies
- **Congregation**: User management and group administration
- **BWI (Business)**: Territory management with three views:
  - **Establishments**: Business location management
  - **Householders**: Individual contact tracking
  - **Map**: Interactive territory visualization
- **Account**: Profile and monthly records management

### Key Components
- **SPA Pattern**: Single-page application with state-driven navigation
- **Event Bus**: Real-time updates across components
- **Offline Store**: Local data persistence
- **Biometric Gate**: Secure access control

## 🗄️ Database Schema

### Core Tables
- **profiles**: User information, roles, and contact details (phone, address, coordinates)
- **monthly_records**: Service hours and bible studies
- **congregations**: Group management
- **business_establishments**: Territory locations
- **business_householders**: Individual contacts
- **business_visits**: Field service records
- **push_subscriptions**: Push notification subscriptions

### Security
- **Row Level Security (RLS)**: Data access control
- **Role-based permissions**: User/admin/superadmin levels
- **Secure functions**: Database operations with proper authorization

## 🚀 Getting Started

### Prerequisites
- Node.js 18.17 or higher
- npm or yarn
- Supabase account

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd millennial-reign-app
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env.local
   # Add your Supabase URL and anon key
   ```

4. **Set up the database**
   - Run the SQL in `supabase-schema.sql` in your Supabase project
   - This creates all tables, functions, and RLS policies

5. **Start the development server**
   ```bash
   npm run dev
   ```

6. **Open your browser**
   Navigate to [http://localhost:3000](http://localhost:3000)

## 📦 Available Scripts

- `npm run dev` - Start development server with Turbopack
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint
- `npm run db` - Push database changes to Supabase

## 🏗️ Project Structure

```
src/
├── app/                    # Next.js App Router
│   ├── auth/              # Authentication pages
│   ├── globals.css        # Global styles
│   └── layout.tsx         # Root layout
├── components/            # React components
│   ├── business/          # Business territory components
│   ├── congregation/      # Congregation management
│   ├── account/           # User account components
│   ├── nav/               # Navigation components
│   └── ui/                # Shadcn/ui components
├── lib/                   # Utility libraries
│   ├── db/                # Database functions
│   ├── offline/           # Offline storage
│   ├── events/            # Event bus system
│   └── utils/             # Helper functions
└── hooks/                 # Custom React hooks
```

## 🔧 Configuration

### Environment Variables
- `NEXT_PUBLIC_SUPABASE_URL` - Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase anonymous key
- `NEXT_PUBLIC_APP_URL` - Application URL for callbacks
- `NEXT_PUBLIC_VAPID_PUBLIC_KEY` - VAPID public key for push notifications
- `VAPID_PRIVATE_KEY` - VAPID private key for push notifications (server-side)

### Supabase Setup
1. Create a new Supabase project
2. Run the SQL from `supabase-schema.sql`
3. Configure authentication providers
4. Set up storage buckets if needed

## 🚀 Deployment

### Vercel (Recommended)
1. Connect your GitHub repository to Vercel
2. Add environment variables in Vercel dashboard
3. Deploy automatically on push to main branch

### Other Platforms
- **Netlify**: Compatible with Next.js
- **Railway**: Full-stack deployment
- **Docker**: Containerized deployment

## 📱 PWA Features

- **Installable**: Add to home screen
- **Offline Support**: Works without internet
- **Background Sync**: Syncs data when online
- **Push Notifications**: Real-time updates with VAPID keys
- **App-like Experience**: Native feel on mobile
- **Contact Information**: Emergency contact details with GPS coordinates
- **Get Directions**: Direct integration with Google Maps

## 🔒 Security Features

- **Row Level Security**: Database-level access control
- **Biometric Authentication**: Optional fingerprint/face ID
- **Secure Cookies**: HttpOnly, Secure, SameSite
- **CSRF Protection**: Built-in Next.js protection
- **Input Validation**: Client and server-side validation

## 🎨 Design System

- **Dark Theme**: Modern dark UI with light accents
- **Mobile-First**: Responsive design for all devices
- **Accessibility**: WCAG compliant components
- **Consistent Spacing**: Tailwind CSS utility classes
- **Smooth Animations**: Motion library integration

## 📊 Performance

- **Turbopack**: Fast development builds
- **Code Splitting**: Automatic route-based splitting
- **Image Optimization**: Next.js Image component
- **Bundle Analysis**: Optimized JavaScript bundles
- **Caching**: Aggressive caching strategies

## 📚 Documentation

- [Features](docs/FEATURES.md) - Detailed feature documentation
- [Changelog](CHANGELOG.md) - Recent updates and changes

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

This project is private and proprietary.

## 🆘 Support

For support and questions, please contact the development team.

---

**Built with ❤️ for Kingdom Ministry**