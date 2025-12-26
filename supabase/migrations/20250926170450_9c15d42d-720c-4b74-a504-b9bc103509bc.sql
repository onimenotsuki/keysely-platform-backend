-- Create storage bucket for space images
INSERT INTO storage.buckets (id, name, public) VALUES ('space-images', 'space-images', true);

-- Create storage policies for space images
CREATE POLICY "Anyone can view space images" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'space-images');

CREATE POLICY "Authenticated users can upload space images" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'space-images' AND auth.role() = 'authenticated');

CREATE POLICY "Users can update their uploaded images" 
ON storage.objects 
FOR UPDATE 
USING (bucket_id = 'space-images' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their uploaded images" 
ON storage.objects 
FOR DELETE 
USING (bucket_id = 'space-images' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Insert seed categories
INSERT INTO categories (name, description, image_url) VALUES 
  ('Oficina Privada', 'Espacios privados para equipos pequeños o trabajo individual', '/placeholder.svg?height=200&width=300&text=Oficina+Privada'),
  ('Sala de Reuniones', 'Salas equipadas para reuniones y presentaciones', '/placeholder.svg?height=200&width=300&text=Sala+Reuniones'),
  ('Coworking', 'Espacios compartidos con ambiente colaborativo', '/placeholder.svg?height=200&width=300&text=Coworking'),
  ('Sala de Conferencias', 'Espacios grandes para eventos y conferencias', '/placeholder.svg?height=200&width=300&text=Conferencias'),
  ('Estudio Creativo', 'Espacios diseñados para trabajo creativo y artístico', '/placeholder.svg?height=200&width=300&text=Estudio+Creativo');