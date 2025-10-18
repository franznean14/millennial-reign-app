# Changelog

All notable changes to the Millennial Reign App will be documented in this file.

## [Latest] - 2025-01-18

### ✨ Added
- **BWI Visit History**
  - Timeline view of business witnessing visits with clickable navigation
  - Proper distinction between establishment and householder visits
  - Establishment badges for householder visits showing context
  - Truncated descriptions in summary view, full details in drawer
  - Smart back navigation using SPA navigation stack
  - Improved timeline styling with thicker, grayed-out lines

- **Visit Updates Timeline**
  - Timeline design for establishment and householder visit updates
  - Maximum 3 visits in main view with clickable arrow for drawer
  - Infinite scroll in drawer with gradual loading
  - 10% smaller avatars for better space utilization
  - Partner publisher avatar support with overlapping style

- **Dynamic Navigation Stack**
  - SPA navigation stack tracking for proper back button behavior
  - Tracks current section instead of hardcoded navigation
  - Fixes navigation from home to establishment details
  - Proper back button behavior in all scenarios

- **Context-Aware Visit Updates**
  - Smart badge display in visit updates timeline
  - Shows establishment names when viewing householder details
  - Shows householder names when viewing establishment details
  - Eliminates redundant information display

- **Complete Establishment Status Options**
  - Added missing "For Replenishment" status option
  - All establishment statuses now available in form dropdown
  - Proper status categorization for business territory management

### 🔧 Improved
- **Profile Form Reorganization**
  - Sectioned form layout: Personal, Contact and Address, Congregation
  - Elder-only access to Group field management
  - Improved form organization and user experience
  - Role-based field visibility and access control

- **Map Search Functionality**
  - Real-time search filtering in map view
  - Search bar visible in map view with dynamic placeholders
  - Live marker updates during search
  - Smooth map filtering without view jumping

- **Map Marker Animations**
  - CSS keyframe animations for marker appearance
  - Staggered animation timing for multiple markers
  - Bouncy scale and opacity transitions
  - Smooth marker emergence on map load

### 🔧 Improved
- **Map Performance**
  - Optimized marker rendering without full map re-renders
  - Fixed map bounds jumping during filtering
  - Improved search filtering performance
  - Better marker cluster group updates

- **Contact Information System**
  - Phone number and address fields in user profiles
  - GPS coordinates with "Get Directions" functionality
  - Contact Information section in account page
  - Emergency contact access for congregation elders

- **Push Notifications**
  - Web Push API integration with VAPID keys
  - Real-time notification delivery
  - iOS and Android support (PWA installation required)
  - Notification settings in account page
  - Test notification functionality

- **Privacy Policy**
  - Comprehensive privacy policy with drawer modal
  - Legal section in account page with "Learn more" button
  - Privacy policy navigation links

- **Smart Form Features**
  - Change detection for profile forms
  - Intelligent save button (only active when changes detected)
  - Philippines phone number format placeholder (+63 912 345 6789)
  - GPS coordinate input with "Get Coord" button

- **Performance Monitoring**
  - Vercel Speed Insights integration
  - Performance tracking and optimization

### 🔧 Improved
- **Database Schema**
  - Added contact fields to profiles table
  - Enhanced RLS policies for security
  - Fixed function search path vulnerabilities
  - Added push subscription management

- **User Experience**
  - Better address formatting with multi-line display
  - Improved contact information layout alignment
  - Enhanced visual indicators for interactive elements
  - Safe area padding for mobile devices

- **Form Validation**
  - Fixed uninitialized variable errors
  - Resolved double save button issues
  - Improved form state management
  - Better error handling and user feedback

### 🐛 Fixed
- **Profile Form Issues**
  - Fixed save button stuck in "Saving..." state
  - Resolved double button rendering bug
  - Fixed uninitialized variable access errors
  - Improved change detection logic

- **Database Migration Issues**
  - Resolved CLI migration conflicts
  - Added proper conflict handling for existing objects
  - Fixed trigger and table creation conflicts
  - Improved migration safety with IF NOT EXISTS clauses

- **Push Notification Issues**
  - Fixed VAPID key format compatibility
  - Resolved iOS Safari base64 decoding issues
  - Fixed subscription cleanup on PWA reinstall
  - Improved error handling and user feedback

### 🔒 Security
- **Enhanced RLS Policies**
  - Secured admin_users table with proper access control
  - Fixed function search path vulnerabilities
  - Added proper permissions for contact information access
  - Improved data protection and privacy

### 📱 Mobile Improvements
- **Better Mobile Experience**
  - Improved touch targets and spacing
  - Enhanced drawer modal interactions
  - Better safe area handling for bottom navigation
  - Improved visual feedback for interactive elements

### 🛠️ Technical Improvements
- **Code Quality**
  - Fixed TypeScript errors and warnings
  - Improved component structure and organization
  - Better error handling and user feedback
  - Enhanced accessibility features

- **Database Management**
  - Improved migration handling
  - Better conflict resolution
  - Enhanced schema documentation
  - Added helper functions for data access

## Previous Versions

### [v1.0.0] - Initial Release
- Core PWA functionality
- User management and authentication
- Business territory management
- Field service tracking
- Offline-first architecture
- Biometric security features
