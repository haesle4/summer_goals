# Summer Goals App

A collaborative habit tracking application with user authentication and real-time data sharing.

## Features

- User authentication (login/signup)
- Create and share habits
- Join habits created by others
- Real-time updates across all users
- Beautiful gold, orange, and white theme

## Setup Instructions

### 1. Create a Supabase Project

1. Go to [https://supabase.com](https://supabase.com) and create a free account
2. Create a new project
3. Wait for the project to be set up (takes ~2 minutes)

### 2. Set Up Database Tables

In your Supabase project dashboard, go to the SQL Editor and run these commands:

```sql
-- Create users table
CREATE TABLE users (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create habits table
CREATE TABLE habits (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    goal TEXT,
    creator TEXT NOT NULL,
    participants TEXT[] DEFAULT ARRAY[]::TEXT[],
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE habits ENABLE ROW LEVEL SECURITY;

-- Create policies for users table
CREATE POLICY "Users can read all users" ON users
    FOR SELECT USING (true);

CREATE POLICY "Users can insert themselves" ON users
    FOR INSERT WITH CHECK (true);

-- Create policies for habits table
CREATE POLICY "Anyone can read habits" ON habits
    FOR SELECT USING (true);

CREATE POLICY "Authenticated users can create habits" ON habits
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Anyone can update habits" ON habits
    FOR UPDATE USING (true);
```

### 3. Get Your Supabase Credentials

1. In your Supabase project, go to Settings > API
2. Copy your **Project URL** and **anon/public key**
3. Update `config.js` with your credentials:

```javascript
const SUPABASE_CONFIG = {
  url: "YOUR_PROJECT_URL",
  anonKey: "YOUR_ANON_KEY",
};
```

### 4. Run Locally

```bash
python3 -m http.server 8080
```

Then open http://localhost:8080 in your browser.

### 5. Deploy to Netlify

The app is already configured for Netlify deployment. Just push your changes and deploy!

## Tech Stack

- Frontend: HTML, CSS, JavaScript
- Backend: Supabase (PostgreSQL)
- Hosting: Netlify
