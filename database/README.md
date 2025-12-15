# Database Setup Guide

## Supabase Setup

1. **Create Supabase Account**
   - Go to https://supabase.com
   - Sign up for free account
   - Create a new project

2. **Get Credentials**
   - Go to Project Settings → API
   - Copy:
     - `Project URL` → `SUPABASE_URL`
     - `service_role` key (secret) → `SUPABASE_SERVICE_ROLE_KEY`
     - `anon` key (public) → `SUPABASE_ANON_KEY` (optional, for client-side)

3. **Run Schema Migration**
   - Go to SQL Editor in Supabase Dashboard
   - Copy contents of `schema.sql`
   - Paste and run in SQL Editor
   - Or use Supabase CLI: `supabase db push`

4. **Set Environment Variables in Vercel**
   - Go to Vercel Dashboard → Project Settings → Environment Variables
   - Add:
     ```
     SUPABASE_URL=https://your-project.supabase.co
     SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
     ```

## Database Structure

### Core Tables
- `users` - All users (travelers, guides, admins)
- `guides` - Guide-specific profiles
- `countries` - Country reference data
- `cities` - City reference data
- `tags` - Tags for categorization
- `locations` - Verified locations database
- `location_photos` - Photos for locations
- `location_tags` - Location-tag relationships

### Tours Tables
- `tours` - Guide-created tours
- `tour_days` - Days within a tour
- `tour_blocks` - Time blocks within a day
- `tour_items` - Locations/activities in a block
- `tour_tags` - Tour-tag relationships
- `tour_additional_options` - Additional services/pricing

### Itineraries Tables
- `itineraries` - Generated plans for users
- `itinerary_items` - Locations in generated itinerary

### Analytics Tables
- `payments` - Payment records
- `audit_log` - Change tracking for admin

## Migration Commands

```bash
# Using Supabase CLI (if installed)
supabase db push

# Or manually via SQL Editor in Supabase Dashboard
# Copy and paste schema.sql content
```

