# Christian Life & Ministry Meeting Assignments

## Overview

Build a system where elders can upload the Life and Ministry Meeting Workbook PDF, automatically extract weekly meeting parts, and assign publishers to each numbered part. The system will provide intelligent filtering based on part requirements (e.g., elder/MS only for certain parts) and work offline-first with Supabase sync.

## Database Schema Changes

### New Tables

#### 1. meeting_weeks

- id (uuid, primary key)
- congregation_id (uuid, foreign key)
- week_start_date (date) -- e.g., "2025-09-15"
- week_end_date (date) -- e.g., "2025-09-21"
- meeting_type (enum: 'midweek', 'weekend')
- source_file_name (text) -- original PDF filename
- created_at (timestamp)
- updated_at (timestamp)

#### 2. meeting_parts

- id (uuid, primary key)
- meeting_week_id (uuid, foreign key)
- part_number (integer) -- 1, 2, 3, etc. for numbered parts
- part_type (text) -- e.g., "Talk", "Bible Reading", "Starting a Conversation"
- section (text) -- e.g., "Treasures From God's Word", "Apply Yourself to Field Ministry"
- title (text) -- extracted title
- duration_minutes (integer)
- reference_material (text) -- scripture references, lesson numbers
- requires_male (boolean)
- requires_elder_or_ms (boolean)
- requires_assistant (boolean)
- assistant_same_gender (boolean)
- part_order (integer) -- display order
- custom_notes (text)
- created_at (timestamp)
- updated_at (timestamp)

#### 3. meeting_assignments

- id (uuid, primary key)
- meeting_part_id (uuid, foreign key)
- publisher_id (uuid, foreign key to profiles)
- role (enum: 'student', 'assistant', 'conductor', 'reader', 'chairman')
- assigned_by (uuid, foreign key to profiles)
- assigned_at (timestamp)
- notes (text)
- created_at (timestamp)
- updated_at (timestamp)

#### 4. meeting_templates (for custom part types)

- id (uuid, primary key)
- congregation_id (uuid, foreign key)
- name (text)
- section (text)
- default_duration (integer)
- requires_male (boolean)
- requires_elder_or_ms (boolean)
- requires_assistant (boolean)
- created_at (timestamp)

#### 5. meeting_duties (for operational duties like attendant, sound, etc.)

- id (uuid, primary key)
- congregation_id (uuid, foreign key)
- duty_type (enum: 'attendant', 'security', 'sound', 'video', 'platform', 'microphones', 'cleaning', 'lawn_garden', 'speaker_hospitality', 'zoom_host')
- week_start_date (date) -- week this duty is for
- meeting_type (enum: 'midweek', 'weekend', 'both') -- which meeting(s) this applies to
- publisher_id (uuid, foreign key to profiles)
- partner_id (uuid, foreign key to profiles, nullable) -- for duties that may have pairs
- assigned_by (uuid, foreign key to profiles)
- assigned_at (timestamp)
- notes (text)
- created_at (timestamp)
- updated_at (timestamp)

## Implementation Steps

### Phase 1: Database Setup

1. Create migration file for new tables
2. Add RLS policies (elders can manage, publishers can view their assignments)
3. Create helper functions for querying assignments

### Phase 2: PDF Processing

1. Add PDF.js or similar library for client-side PDF parsing
2. Create parser logic to extract:

- Week dates
- Part numbers and titles
- Section information
- Duration
- Reference material

3. Use JW reference document to map part types to requirements (male only, elder/MS, assistant needed)
4. Store parsed data in meeting_weeks and meeting_parts tables

### Phase 3: Assignment UI (Elder Interface)

1. Create MeetingsSection component enhancement:

- Upload PDF button (elders only)
- Week selector/calendar view
- List of parts for selected week

2. Create AssignmentForm component:

- Select part
- Publisher dropdown (filtered by requirements)
- Assistant selection if needed
- Notes field
- Save assignment

3. Intelligent filtering:

- Show only eligible publishers based on part requirements
- Filter by privileges (Elder, MS, Publisher)
- Filter by gender if required

### Phase 4: Publisher View

1. Add "My Assignments" card to home page or congregation view
2. Show upcoming assignments with:

- Date
- Part type and title
- Time/duration
- Reference material to prepare
- Partner/assistant if applicable

3. Add push notification when assigned to a part

### Phase 5: Offline Support

1. Cache meeting weeks and parts in IndexedDB
2. Allow viewing assignments offline
3. Queue assignment changes for sync when online
4. Add conflict resolution for simultaneous edits

## Files to Create/Modify

### Database

- `supabase/migrations/[timestamp]_add_meeting_assignments.sql`

### Components

- `src/components/congregation/MeetingAssignments.tsx` (main component)
- `src/components/congregation/PDFUploader.tsx`
- `src/components/congregation/WeekSelector.tsx`
- `src/components/congregation/PartAssignmentForm.tsx`
- `src/components/home/MyAssignments.tsx` (publisher view)

### Database Functions

- `src/lib/db/meetings.ts` (CRUD operations)

### Types

- Update `src/lib/db/types.ts` with new interfaces

## Key Features

- PDF upload and automatic parsing
- Intelligent publisher filtering based on part requirements
- Elder assignment interface
- Publisher assignment view
- Push notifications for new assignments
- Offline-first with background sync
- Weekly schedule view
- Search and filter publishers