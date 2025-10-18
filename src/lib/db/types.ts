export type Role = "user" | "admin" | "superadmin";

export type Privilege =
  | "Elder"
  | "Ministerial Servant"
  | "Regular Pioneer"
  | "Auxiliary Pioneer"
  | "Secretary"
  | "Coordinator"
  | "Group Overseer"
  | "Group Assistant"; // Added Group Assistant

export type Gender = "male" | "female";

export interface Profile {
  id: string; // matches auth.users.id
  first_name: string;
  last_name: string;
  middle_name?: string | null;
  date_of_birth?: string | null; // YYYY-MM-DD
  date_of_baptism?: string | null; // YYYY-MM-DD
  privileges: Privilege[];
  avatar_url?: string | null;
  role: Role;
  time_zone?: string | null;
  username?: string | null;
  // Congregation and profile fields
  gender?: Gender | null; // optional; required when assigning male-only privileges
  congregation_id?: string | null;
  group_name?: string | null; // Add group name field
  // Contact information fields
  phone_number?: string | null;
  address?: string | null;
  address_latitude?: number | null;
  address_longitude?: number | null;
}

export interface MonthlyRecord {
  id: string;
  user_id: string; // references profiles.id
  month: string; // YYYY-MM
  hours: number;
  bible_studies: number; // monthly aggregate count (not names)
  note?: string | null;
}

export interface DailyRecord {
  id: string;
  user_id: string;
  date: string; // YYYY-MM-DD
  hours: number;
  bible_studies: string[]; // names
  note?: string | null;
}
