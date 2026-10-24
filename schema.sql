-- =========================================================
-- STUDY RESOURCE ORGANIZER - Cloudflare D1 / SQLite
-- Safe to re-run: table, indexes, and seed rows are idempotent.
-- =========================================================

CREATE TABLE IF NOT EXISTS study_resources (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL CHECK(length(trim(title)) BETWEEN 1 AND 150),
  subject TEXT NOT NULL CHECK(length(trim(subject)) BETWEEN 1 AND 100),
  resource_type TEXT NOT NULL CHECK(resource_type IN ('PDF','Notes','Video','Website','Presentation','Article','Other')),
  url TEXT NOT NULL CHECK(length(url) BETWEEN 1 AND 500),
  description TEXT NOT NULL DEFAULT '' CHECK(length(description) <= 2000),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_study_resources_subject ON study_resources(subject);
CREATE INDEX IF NOT EXISTS idx_study_resources_type ON study_resources(resource_type);
CREATE INDEX IF NOT EXISTS idx_study_resources_created ON study_resources(created_at DESC);

INSERT INTO study_resources (title, subject, resource_type, url, description)
SELECT 'HTML and CSS: Getting Started', 'Web Development', 'Website',
       'https://developer.mozilla.org/en-US/docs/Learn_web_development/Core/Structuring_content',
       'A beginner-friendly introduction to structuring web pages and core web concepts.'
WHERE NOT EXISTS (SELECT 1 FROM study_resources WHERE title = 'HTML and CSS: Getting Started');

INSERT INTO study_resources (title, subject, resource_type, url, description)
SELECT 'JavaScript Guide', 'Programming', 'Website',
       'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide',
       'Reference for JavaScript fundamentals, functions, objects, and asynchronous programming.'
WHERE NOT EXISTS (SELECT 1 FROM study_resources WHERE title = 'JavaScript Guide');

INSERT INTO study_resources (title, subject, resource_type, url, description)
SELECT 'Introduction to Data Mining', 'Data Mining', 'Video',
       'https://www.youtube.com/results?search_query=introduction+to+data+mining',
       'Video search for introductory data mining lessons.'
WHERE NOT EXISTS (SELECT 1 FROM study_resources WHERE title = 'Introduction to Data Mining');

INSERT INTO study_resources (title, subject, resource_type, url, description)
SELECT 'SQL SELECT and Filtering Notes', 'Database Systems', 'Article',
       'https://dev.mysql.com/doc/refman/8.0/en/select.html',
       'Documentation for retrieving records with SELECT queries and filtering results.'
WHERE NOT EXISTS (SELECT 1 FROM study_resources WHERE title = 'SQL SELECT and Filtering Notes');

INSERT INTO study_resources (title, subject, resource_type, url, description)
SELECT 'Python Tutorial', 'Programming', 'Website',
       'https://docs.python.org/3/tutorial/',
       'Official Python tutorial covering core language concepts and examples.'
WHERE NOT EXISTS (SELECT 1 FROM study_resources WHERE title = 'Python Tutorial');
