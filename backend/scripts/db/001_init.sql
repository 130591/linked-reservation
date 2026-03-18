DROP TYPE IF EXISTS workout_status CASCADE;
DROP TYPE IF EXISTS exercise_difficulty CASCADE;
DROP TYPE IF EXISTS exercise_category CASCADE;

-- Create enum types
CREATE TYPE workout_status AS ENUM ('scheduled', 'done', 'undone', 'completed');
CREATE TYPE exercise_difficulty AS ENUM ('beginner', 'intermediate', 'advanced', 'elite');
CREATE TYPE exercise_category AS ENUM (
    'multi_joint',    -- Multiarticular (ex: squats, deadlifts)
    'isolation',      -- Isolado (ex: bicep curls, leg extensions)
    'compound',       -- Composto (multiple joint movements)
    'cardio',         -- Cardio exercises
    'flexibility',    -- Stretching and mobility
    'core',           -- Core-specific exercises
    'calisthenics'    -- Bodyweight exercises
);

-- Users table
CREATE TABLE users (
    user_id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(100) NOT NULL,
    birth_date DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP WITH TIME ZONE
);

-- User settings
CREATE TABLE user_settings (
    user_id INT PRIMARY KEY REFERENCES users(user_id) ON DELETE CASCADE,
    weekly_calorie_goal INT,
    weekly_workout_goal INT,
    measurement_system VARCHAR(10) DEFAULT 'metric', -- metric/imperial
    timezone VARCHAR(50) DEFAULT 'UTC'
);

-- Exercises catalog
CREATE TABLE exercises (
    exercise_id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    difficulty exercise_difficulty,
    category exercise_category,
    equipment_needed VARCHAR(100)[],
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Workouts
CREATE TABLE workouts (
    workout_id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    scheduled_at TIMESTAMP WITH TIME ZONE NOT NULL,
    completed_at TIMESTAMP WITH TIME ZONE,
    status workout_status NOT NULL DEFAULT 'scheduled',
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Workout exercises
CREATE TABLE workout_exercises (
    workout_id INT REFERENCES workouts(workout_id) ON DELETE CASCADE,
    exercise_id INT REFERENCES exercises(exercise_id),
    sets INT NOT NULL,
    reps INT,
    weight_kg DECIMAL(5,2),
    order_index INT NOT NULL,
    notes TEXT,
    PRIMARY KEY (workout_id, exercise_id, order_index)
);

-- Create indexes for better performance
CREATE INDEX idx_workouts_user_id ON workouts(user_id);
CREATE INDEX idx_workout_exercises_workout_id ON workout_exercises(workout_id);
CREATE INDEX idx_workout_exercises_exercise_id ON workout_exercises(exercise_id);