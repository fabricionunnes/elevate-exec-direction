-- Make the resumes bucket public so signed URLs work correctly
UPDATE storage.buckets 
SET public = true 
WHERE id = 'resumes';