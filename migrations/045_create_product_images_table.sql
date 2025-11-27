-- Create product_images table for storing product images and videos
CREATE TABLE IF NOT EXISTS product_images (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_name VARCHAR(255) NOT NULL,
    size_index INTEGER NOT NULL,
    file_url TEXT NOT NULL,
    file_type VARCHAR(50) NOT NULL, -- 'image' or 'video'
    file_name VARCHAR(255),
    file_size INTEGER, -- in bytes
    uploaded_by VARCHAR(255),
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(product_name, size_index, file_url)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_product_images_product_name ON product_images(product_name);
CREATE INDEX IF NOT EXISTS idx_product_images_size_index ON product_images(size_index);
CREATE INDEX IF NOT EXISTS idx_product_images_product_size ON product_images(product_name, size_index);

-- Create trigger to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_product_images_updated_at() RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_product_images_updated_at_trigger ON product_images;
CREATE TRIGGER update_product_images_updated_at_trigger
BEFORE UPDATE ON product_images
FOR EACH ROW EXECUTE FUNCTION update_product_images_updated_at();

