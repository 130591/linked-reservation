
INSERT INTO users (email, password_hash, name, birth_date) VALUES
('user1@example.com', '$2a$10$XFDq3fQh1eHdIt5y5z4jUO8Xe1n8QbX9rJkLmNOPQRSTsVW1yYd5a', 'John Smith', '1990-05-15'),
('trainer@example.com', '$2a$10$XFDq3fQh1eHdIt5y5z4jUO8Xe1n8QbX9rJkLmNOPQRSTsVW1yYd5a', 'Mary Trainer', '1985-10-20');

INSERT INTO user_settings (user_id, weekly_calorie_goal, weekly_workout_goal) VALUES
(1, 2000, 4),
(2, 2500, 5);

INSERT INTO exercises (name, description, difficulty, category, equipment_needed) VALUES
('Barbell Back Squat', 'Barbell back squat', 'intermediate', 'multi_joint', ARRAY['barbell', 'weight plates']),
('Barbell Bench Press', 'Flat bench press with barbell', 'beginner', 'multi_joint', ARRAY['bench', 'barbell', 'weight plates']),
('Deadlift', 'Conventional deadlift with barbell', 'intermediate', 'multi_joint', ARRAY['barbell', 'weight plates']),
('Overhead Press', 'Military press with barbell', 'intermediate', 'multi_joint', ARRAY['barbell', 'weight plates']),
('Bent Over Row', 'Bent over barbell row', 'intermediate', 'multi_joint', ARRAY['barbell', 'weight plates']),

('Dumbbell Bicep Curl', 'Standing bicep curl with dumbbells', 'beginner', 'isolation', ARRAY['dumbbells']),
('Dumbbell Lateral Raise', 'Standing lateral shoulder raise', 'beginner', 'isolation', ARRAY['dumbbells']),
('Tricep Rope Pushdown', 'Tricep pushdown with rope attachment', 'beginner', 'isolation', ARRAY['cable machine', 'rope']),
('Leg Extension', 'Quadriceps extension machine', 'beginner', 'isolation', ARRAY['leg extension machine']),
('Hamstring Curl', 'Lying or seated hamstring curl', 'beginner', 'isolation', ARRAY['leg curl machine']),

('Treadmill Run', 'Moderate pace running', 'beginner', 'cardio', ARRAY['treadmill']),
('Stationary Bike', 'Moderate cycling', 'beginner', 'cardio', ARRAY['exercise bike']),
('Rowing Machine', 'Full body rowing', 'intermediate', 'cardio', ARRAY['rowing machine']),


('Plank', 'Front plank hold', 'beginner', 'core', ARRAY['yoga mat']),
('Hanging Leg Raise', 'Hanging knee/leg raise', 'intermediate', 'core', ARRAY['pull-up bar']),
('Russian Twist', 'Seated weighted twist', 'beginner', 'core', ARRAY['medicine ball', 'yoga mat']),

('Pull-up', 'Bodyweight pull-up', 'intermediate', 'calisthenics', ARRAY['pull-up bar']),
('Push-up', 'Standard push-up', 'beginner', 'calisthenics', ARRAY['yoga mat']),
('Bodyweight Squat', 'Air squat', 'beginner', 'calisthenics', ARRAY['none']);

INSERT INTO workouts (user_id, scheduled_at, status, notes) VALUES
(1, CURRENT_TIMESTAMP, 'scheduled', 'Workout A - Chest & Triceps'),
(1, CURRENT_TIMESTAMP + INTERVAL '2 days', 'scheduled', 'Workout B - Back & Biceps'),
(1, CURRENT_TIMESTAMP - INTERVAL '1 day', 'completed', 'Workout C - Legs & Core');

INSERT INTO workout_exercises (workout_id, exercise_id, sets, reps, weight_kg, order_index) VALUES

(1, 2, 4, 10, 60, 1),
(1, 7, 3, 12, 8, 2),
(1, 8, 3, 12, 15, 3), 
(1, 13, 3, 60, NULL, 4), 

(2, 5, 4, 8, 40, 1),
(2, 6, 3, 12, 12, 2), 
(2, 17, 3, 10, NULL, 3),

(3, 1, 4, 8, 80, 1), 
(3, 3, 3, 6, 100, 2), 
(3, 11, 1, 20, NULL, 3),
(3, 13, 3, 45, NULL, 4),
(3, 15, 3, 20, 5, 5);

UPDATE workouts 
SET completed_at = scheduled_at + INTERVAL '1 hour'
WHERE workout_id = 3;

-- Mark exercises as completed for the finished workout
UPDATE workout_exercises we
SET notes = 'Completed with good form'
WHERE workout_id = 3;