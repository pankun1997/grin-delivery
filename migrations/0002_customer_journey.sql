ALTER TABLE galleries ADD COLUMN page_stage TEXT NOT NULL DEFAULT 'delivered' CHECK (page_stage IN ('scheduled', 'editing', 'delivered'));
ALTER TABLE galleries ADD COLUMN shoot_time TEXT;
ALTER TABLE galleries ADD COLUMN plan_name TEXT;
ALTER TABLE galleries ADD COLUMN meeting_details TEXT;
ALTER TABLE galleries ADD COLUMN schedule_details TEXT;
ALTER TABLE galleries ADD COLUMN belongings TEXT;
ALTER TABLE galleries ADD COLUMN rain_policy TEXT;
ALTER TABLE galleries ADD COLUMN payment_details TEXT;
