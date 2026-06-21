# ServiceHub

> **Services Marketplace Application**

## Overview

**ServiceHub** is a services marketplace platform that enables:

- **Clients**: Search, book and pay for professional services
- **Providers**: Offer services, manage bookings and receive payments
- **Administrators**: Moderate content, manage payments and monitor the platform

### Main Features

✅ JWT registration and authentication with roles  
✅ Complete user profile management  
✅ Services catalog with search and filters  
✅ Booking and ratings system  
✅ Stripe integrated payments  
✅ Real-time push notifications  
✅ Geolocation and maps  
✅ Real-time chat (WebSockets)  
✅ Admin dashboard  
✅ Dark Mode and accessibility  
✅ Automated testing (Jest, Detox)  
✅ CI/CD and automated deployment  
✅ Monitoring with Sentry

---

## Tech Stack

### Mobile Frontend

| Technology              | Version | Purpose                     | Why                                        |
| ----------------------- | ------- | --------------------------- | ------------------------------------------ |
| **React Native**        | 0.75+   | Cross-platform framework    | Shared code iOS/Android                    |
| **Expo**                | v56+    | Development platform        | No need for XCode/Android Studio initially |
| **TypeScript**          | 5.x     | Typed language              | Type-safety, better DX, error prevention   |
| **Expo Router**         | Latest  | File-based navigation       | File-based routing like Next.js            |
| **React Navigation**    | 6.x     | Stack/Tab/Drawer navigation | Industry standard for RN                   |
| **Zustand**             | 5.x     | Light state management      | Simple alternative to Redux                |
| **React Query**         | 5.x     | Remote data management      | Cache, sync, automatic refetch             |
| **Axios**               | 1.x     | HTTP client                 | Interceptors, timeouts, error handling     |
| **React Hook Form**     | 7.x     | Form management             | Performance, smooth UX                     |
| **Zod**                 | 3.x     | Schema validation           | Type-safe runtime validation               |
| **NativeWind**          | 4.x     | Tailwind CSS for RN         | Consistent styles with web                 |
| **Expo Notifications**  | Latest  | Push notifications          | Native integration without complications   |
| **Expo Location**       | Latest  | GPS and geolocation         | Native location access                     |
| **React Native Maps**   | Latest  | Interactive maps            | Live tracking                              |
| **GraphQL**             | Latest  | GraphQL client              | Efficient queries, automatic cache         |
| **Stripe React Native** | Latest  | Secure payments             | PCI compliance                             |
| **Sentry**              | Latest  | Error tracking              | Production monitoring                      |

### Backend

| Technology             | Version | Purpose            | Why                                      |
| ---------------------- | ------- | ------------------ | ---------------------------------------- |
| **Next.js**            | 14.x    | Backend framework  | API Routes, SSR, native TypeScript       |
| **Node.js**            | 20+     | Runtime            | Unified fullstack language               |
| **MongoDB**            | 7.x+    | Database           | NoSQL, flexible, scalable, native JSON   |
| **Mongoose**           | 8.x     | Type-safe ODM      | TypeScript first, migrations, validation |
| **GraphQL**            | Latest  | GraphQL server     | Efficient queries, self-documented       |
| **Stripe API**         | Latest  | Payment processing | Reliable solution, webhooks              |
| **Firebase Admin SDK** | Latest  | Push notifications | Cloud Messaging                          |
| **JWT**                | -       | Authentication     | Stateless, secure, standard              |
| **bcrypt**             | Latest  | Password hashing   | Standard security                        |
| **Docker**             | Latest  | Containerization   | Dev/prod consistency                     |

### DevOps & CI/CD

| Technology         | Purpose                                  |
| ------------------ | ---------------------------------------- |
| **Expo EAS**       | Remote build and update                  |
| **EAS Build**      | iOS/Android build without local machines |
| **GitHub Actions** | Automated CI/CD                          |
| **Docker**         | Backend containerization                 |
| **Vercel**         | Documentation and dashboard deployment   |
| **Sentry**         | Production error tracking                |

### Testing

| Tool                             | Type                | Coverage                    |
| -------------------------------- | ------------------- | --------------------------- |
| **Jest**                         | Unit Testing        | Functions, utilities, hooks |
| **React Native Testing Library** | Integration Testing | Components, flows           |
| **Detox**                        | E2E Testing         | Complete flows, UI          |
| **MSW**                          | API Mocking         | Testing without backend     |

---

## Project Architecture

### Architectural Principles

```
┌─────────────────────────────────────────────┐
│         PRESENTATION LAYER                  │
│  (Screens, Components, Navigation)          │
└──────────────────┬──────────────────────────┘
                   │
┌──────────────────┴──────────────────────────┐
│    APPLICATION LAYER                        │
│  (State Management, Business Logic)         │
│  Zustand, React Query, Hooks                │
└──────────────────┬──────────────────────────┘
                   │
┌──────────────────┴──────────────────────────┐
│      DOMAIN LAYER                           │
│  (Business Rules, Use Cases)                │
│  Services, Validators                       │
└──────────────────┬──────────────────────────┘
                   │
┌──────────────────┴──────────────────────────┐
│       DATA LAYER                            │
│  (API, Storage, Cache)                      │
│  Axios, AsyncStorage, React Query           │
└─────────────────────────────────────────────┘
```

## Initial Setup

### System Requirements

- **Node.js**: v20+
- **npm/pnpm**: latest version
- **Expo CLI**: `npm install -g expo-cli`
- **Git**: v2.x
- **Visual Studio Code** (recommended)

### Project Setup

```bash
# 1. Clone the project
git clone https://github.com/randy930529/servicehub.git
cd servicehub

# 2. Install dependencies
pnpm install

# 3. Configure environment
cp .env.example .env

# 4. Start Expo
pnpm start

# 5. In another terminal, open in Expo Go
pnpm preview
```

## License

MIT License - Free for educational and commercial use

---

**Last updated**: June 21, 2026
**Version**: 1.0.0
**Status**: Active

---
