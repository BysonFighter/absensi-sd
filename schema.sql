CREATE TABLE IF NOT EXISTS classes (
  code TEXT PRIMARY KEY,
  grade INTEGER NOT NULL,
  section TEXT NOT NULL,
  name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  full_name TEXT NOT NULL,
  class_code TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'wali_kelas',
  FOREIGN KEY (class_code) REFERENCES classes(code)
);

CREATE TABLE IF NOT EXISTS students (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  class_code TEXT NOT NULL,
  nisn TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  number INTEGER,
  FOREIGN KEY (class_code) REFERENCES classes(code)
);

CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL,
  expires_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS attendance (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  class_code TEXT NOT NULL,
  attendance_date TEXT NOT NULL,
  student_id INTEGER NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('H','S','I','A')),
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(class_code, attendance_date, student_id),
  FOREIGN KEY (student_id) REFERENCES students(id)
);
