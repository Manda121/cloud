CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  firstname TEXT,
  lastname TEXT,
  attempts INT DEFAULT 0,
  blocked BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

insert into users (email, password, firstname, lastname) values
('notiavinamandaniaina@gmail.com', '1212manda', 'Mandaniaina', 'Notiavina');