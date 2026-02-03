-- Create storage bucket for PDF cookbook uploads
INSERT INTO storage.buckets (id, name, public)
VALUES ('cookbooks', 'cookbooks', false)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload PDFs to cookbooks bucket
CREATE POLICY "Users can upload cookbook PDFs"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'cookbooks');

-- Allow users to read their uploaded PDFs
CREATE POLICY "Users can read cookbook PDFs"
ON storage.objects FOR SELECT
USING (bucket_id = 'cookbooks');

-- Allow users to delete their uploaded PDFs
CREATE POLICY "Users can delete cookbook PDFs"
ON storage.objects FOR DELETE
USING (bucket_id = 'cookbooks');