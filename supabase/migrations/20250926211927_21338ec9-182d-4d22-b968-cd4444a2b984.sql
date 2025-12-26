-- First, update spaces that reference duplicate categories to use the correct ones
UPDATE spaces SET category_id = 'a2309c2b-bf68-4e5d-9459-d6fd1ba4298e' 
WHERE category_id = '1c640be8-f006-4a3e-b2c9-d8f736f54c93'; -- Update duplicate Coworking

UPDATE spaces SET category_id = 'cf6bdd6f-538b-476d-b58e-d71c83fd7898' 
WHERE category_id = '5af45a4f-1fa0-4eea-9cd8-dec55e118218'; -- Update duplicate Oficina Privada

UPDATE spaces SET category_id = '1c982c1b-6dc0-4802-8b6f-0978d5ccb942' 
WHERE category_id = '3a6c0172-e397-4c42-821d-0d76b62e031b'; -- Update duplicate Sala de Conferencias

UPDATE spaces SET category_id = '47dab93d-28e0-4082-b8ec-90410a5a4185' 
WHERE category_id = '23139076-2590-41da-ab92-3d614fe60226'; -- Update duplicate Sala de Reuniones

-- Now remove duplicate categories
DELETE FROM categories WHERE id IN (
  '1c640be8-f006-4a3e-b2c9-d8f736f54c93', -- Duplicate Coworking
  '5af45a4f-1fa0-4eea-9cd8-dec55e118218', -- Duplicate Oficina Privada
  '3a6c0172-e397-4c42-821d-0d76b62e031b', -- Duplicate Sala de Conferencias
  '23139076-2590-41da-ab92-3d614fe60226'  -- Duplicate Sala de Reuniones
);

-- Add missing categories
INSERT INTO categories (name, description, image_url) VALUES 
  ('Consultorios', 'Espacios profesionales para consultas y atención personalizada', '/src/assets/category-consultorio.jpg'),
  ('Espacios para Consulta', 'Salas especializadas para consultas profesionales y asesorías', '/src/assets/category-consultorio.jpg');