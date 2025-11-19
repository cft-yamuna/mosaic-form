/*
  # Create user selfies table

  1. New Tables
    - `user_selfies`
      - `id` (uuid, primary key) - Unique identifier for each submission
      - `user_message` (text) - Random message shown to the user
      - `image_url` (text) - URL/path to the uploaded image
      - `created_at` (timestamptz) - Timestamp of submission
  
  2. Security
    - Enable RLS on `user_selfies` table
    - Add policy for anyone to insert selfies (public submission)
    - Add policy for authenticated users to read selfies
*/

CREATE TABLE IF NOT EXISTS user_selfies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_message text NOT NULL,
  image_url text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE user_selfies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public insert"
  ON user_selfies FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Allow authenticated read"
  ON user_selfies FOR SELECT
  TO authenticated
  USING (true);