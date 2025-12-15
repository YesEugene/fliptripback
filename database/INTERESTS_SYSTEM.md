# Interests System Documentation

## Overview

The interests system provides a 3-level hierarchical structure for categorizing locations, tours, and user preferences:

1. **Interest Categories** (Top Level): `active`, `culture`, `food`, `nature`, `nightlife`, `family`, `romantic`
2. **Interest Subcategories** (Middle Level): `winter sports`, `museums`, `restaurants`, etc.
3. **Interests** (Specific Level): `skiing`, `art galleries`, `fine dining`, etc.

## Database Structure

### Tables

- `interest_categories` - Top-level categories
- `interest_subcategories` - Middle-level subcategories (optional)
- `interests` - Specific interests (can be directly under category or under subcategory)
- `location_interests` - Links locations to interests (with relevance_score 1-10)
- `tour_interests` - Links tours to interests
- `city_interests` - Future: Links cities to available interests (for adaptive filtering)

### Relationships

```
interest_categories (1) ──→ (many) interest_subcategories
interest_categories (1) ──→ (many) interests (direct)
interest_subcategories (1) ──→ (many) interests

locations (many) ──→ (many) interests (via location_interests)
tours (many) ──→ (many) interests (via tour_interests)
cities (many) ──→ (many) interests (via city_interests) [future]
```

## Example Structure

```
📁 Active (interest_categories)
  ├─ 📂 Winter Sports (interest_subcategories)
  │   ├─ ⛷️ Skiing (interests)
  │   ├─ 🏂 Snowboarding (interests)
  │   └─ ⛸️ Ice Skating (interests)
  ├─ 📂 Water Sports (interest_subcategories)
  │   ├─ 🏊 Swimming (interests)
  │   └─ 🏄 Surfing (interests)
  └─ 🚴 Cycling (interests - direct, no subcategory)

📁 Culture (interest_categories)
  ├─ 📂 Museums (interest_subcategories)
  │   ├─ 🏛️ History Museums (interests)
  │   └─ 🎨 Art Museums (interests)
  └─ 🏛️ Historical Sites (interests - direct)
```

## Usage in Code

### Getting Interests for Filter

```javascript
// Get all categories with their subcategories and interests
const { data } = await supabase
  .from('interest_categories')
  .select(`
    *,
    subcategories:interest_subcategories(
      *,
      interests:interests(*)
    ),
    direct_interests:interests!interests_category_id_fkey(
      *,
      subcategory_id
    )
  `)
  .order('display_order');
```

### Assigning Interests to Location

```javascript
// When creating/updating location
const locationInterests = [
  { location_id: locationId, interest_id: skiingId, relevance_score: 9 },
  { location_id: locationId, interest_id: snowboardingId, relevance_score: 8 }
];
await supabase.from('location_interests').insert(locationInterests);
```

### Assigning Interests to Tour

```javascript
// When creating/updating tour
const tourInterests = [
  { tour_id: tourId, interest_id: skiingId },
  { tour_id: tourId, interest_id: winterSportsId }
];
await supabase.from('tour_interests').insert(tourInterests);
```

### Searching Locations by Interest

```javascript
// Find locations with specific interest
const { data } = await supabase
  .from('locations')
  .select(`
    *,
    interests:location_interests(
      interest:interests(*)
    )
  `)
  .eq('location_interests.interest_id', interestId)
  .order('location_interests.relevance_score', { ascending: false });
```

### Searching Tours by Interest

```javascript
// Find tours with specific interest
const { data } = await supabase
  .from('tours')
  .select(`
    *,
    interests:tour_interests(
      interest:interests(*)
    )
  `)
  .eq('tour_interests.interest_id', interestId);
```

## User Filter Flow

### Step 1: Select City
- User selects a city (e.g., "Paris")

### Step 2: Select Audience
- User selects audience: `solo`, `couple`, `kids`, `family`, `parents`

### Step 3: Select Top-Level Category
- User sees all available categories:
  - 🏃 Active
  - 🏛️ Culture
  - 🍽️ Food
  - 🌳 Nature
  - 🍸 Nightlife
  - 👨‍👩‍👧 Family
  - 💑 Romantic

### Step 4: Select Subcategory (if applicable)
- If category has subcategories, show them:
  - Active → Winter Sports, Water Sports, Land Sports
- If no subcategories, skip to Step 5

### Step 5: Select Specific Interest
- Show specific interests:
  - Active → Winter Sports → Skiing, Snowboarding, Ice Skating
  - Active → Cycling (direct, no subcategory)

### Step 6: Additional Filters
- Budget
- Duration
- Format (self-guided / with guide)

## Important Notes

### Tour Interests vs Location Interests

**Question**: What if a tour has an interest, but no locations in that tour have that interest?

**Answer**: 
- When searching **tours** by interest → use `tour_interests` table
  - Tour will be found even if locations don't have that interest
  - This allows tours to be tagged with broader interests (e.g., "adventure tour" even if individual locations aren't tagged as "adventure")
  
- When searching **locations** by interest → use `location_interests` table
  - Only locations explicitly tagged with that interest will be found

**Example**:
- Tour "Winter Adventure" has interest "skiing" in `tour_interests`
- But locations in the tour are tagged as "restaurants", "hotels", "skiing equipment shops"
- When user searches for tours with "skiing" → Tour "Winter Adventure" will be found
- When user searches for locations with "skiing" → Only locations tagged with "skiing" will be found

### Relevance Score

- `relevance_score` (1-10) in `location_interests` indicates how relevant a location is for a specific interest
- Example:
  - Ski resort → skiing interest: relevance_score = 10
  - Restaurant near ski resort → skiing interest: relevance_score = 3
- Use for sorting: show most relevant locations first

### City-Based Filtering (Future)

- `city_interests` table is prepared but not used yet
- When implemented, will filter interests based on what's available in selected city
- For now, all interests are shown regardless of city

## Migration from Old Tags System

Old tables (`tags`, `location_tags`, `tour_tags`) are kept for backward compatibility.

Migration strategy:
1. Map existing tags to new interests
2. Create migration script to convert data
3. Update code to use new interests system
4. Remove old tables after migration complete

## API Endpoints Needed

- `GET /api/interests/categories` - Get all categories with structure
- `GET /api/interests?category_id=xxx` - Get interests for category
- `GET /api/interests?subcategory_id=xxx` - Get interests for subcategory
- `POST /api/locations/:id/interests` - Assign interests to location
- `POST /api/tours/:id/interests` - Assign interests to tour

