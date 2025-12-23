-- Create categories table
CREATE TABLE IF NOT EXISTS categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    parent_id INTEGER REFERENCES categories(id) ON DELETE CASCADE,
    created_by VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(name, parent_id)
);

-- Create UOM (Unit of Measurement) table
CREATE TABLE IF NOT EXISTS uom (
    id SERIAL PRIMARY KEY,
    code VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    is_default BOOLEAN DEFAULT FALSE,
    created_by VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create stores table
CREATE TABLE IF NOT EXISTS stores (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    code VARCHAR(50) UNIQUE,
    address TEXT,
    city VARCHAR(100),
    state VARCHAR(100),
    country VARCHAR(100) DEFAULT 'India',
    pincode VARCHAR(20),
    phone VARCHAR(20),
    email VARCHAR(255),
    store_type VARCHAR(50),
    is_active BOOLEAN DEFAULT TRUE,
    created_by VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create items table
CREATE TABLE IF NOT EXISTS items (
    id SERIAL PRIMARY KEY,
    item_id VARCHAR(100) NOT NULL UNIQUE,
    item_name VARCHAR(255) NOT NULL,
    item_type VARCHAR(20) NOT NULL CHECK (item_type IN ('Buy', 'Sell', 'Both')),
    category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
    sub_category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
    micro_category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
    uom_id INTEGER REFERENCES uom(id) ON DELETE SET NULL,
    store_id INTEGER REFERENCES stores(id) ON DELETE SET NULL,
    hsn VARCHAR(50),
    price DECIMAL(15, 2),
    tax_type VARCHAR(20),
    tax DECIMAL(5, 2),
    current_stock DECIMAL(15, 3) DEFAULT 0,
    min_stock DECIMAL(15, 3) DEFAULT 0,
    max_stock DECIMAL(15, 3) DEFAULT 0,
    reject_stock DECIMAL(15, 3) DEFAULT 0,
    item_image TEXT,
    phase_in_insulation VARCHAR(255),
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_by VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create stock_updates table for tracking stock changes
CREATE TABLE IF NOT EXISTS stock_updates (
    id SERIAL PRIMARY KEY,
    item_id INTEGER NOT NULL REFERENCES items(id) ON DELETE CASCADE,
    store_id INTEGER REFERENCES stores(id) ON DELETE SET NULL,
    update_type VARCHAR(20) NOT NULL CHECK (update_type IN ('Add', 'Reduce', 'Transfer', 'Adjustment')),
    quantity DECIMAL(15, 3) NOT NULL,
    previous_stock DECIMAL(15, 3),
    new_stock DECIMAL(15, 3),
    reference_number VARCHAR(100),
    comment TEXT,
    from_store_id INTEGER REFERENCES stores(id) ON DELETE SET NULL,
    to_store_id INTEGER REFERENCES stores(id) ON DELETE SET NULL,
    updated_by VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create item_history table for audit trail
CREATE TABLE IF NOT EXISTS item_history (
    id SERIAL PRIMARY KEY,
    item_id INTEGER NOT NULL REFERENCES items(id) ON DELETE CASCADE,
    action_type VARCHAR(50) NOT NULL,
    old_data JSONB,
    new_data JSONB,
    changed_by VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_items_item_id ON items(item_id);
CREATE INDEX IF NOT EXISTS idx_items_category_id ON items(category_id);
CREATE INDEX IF NOT EXISTS idx_items_store_id ON items(store_id);
CREATE INDEX IF NOT EXISTS idx_items_uom_id ON items(uom_id);
CREATE INDEX IF NOT EXISTS idx_items_created_at ON items(created_at);
CREATE INDEX IF NOT EXISTS idx_items_item_type ON items(item_type);
CREATE INDEX IF NOT EXISTS idx_categories_parent_id ON categories(parent_id);
CREATE INDEX IF NOT EXISTS idx_stock_updates_item_id ON stock_updates(item_id);
CREATE INDEX IF NOT EXISTS idx_stock_updates_created_at ON stock_updates(created_at);
CREATE INDEX IF NOT EXISTS idx_stock_updates_store_id ON stock_updates(store_id);
CREATE INDEX IF NOT EXISTS idx_item_history_item_id ON item_history(item_id);
CREATE INDEX IF NOT EXISTS idx_item_history_created_at ON item_history(created_at);
CREATE INDEX IF NOT EXISTS idx_stores_is_active ON stores(is_active);
CREATE INDEX IF NOT EXISTS idx_uom_is_default ON uom(is_default);

-- Create trigger function for updating updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column() RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply triggers
DROP TRIGGER IF EXISTS update_categories_updated_at ON categories;
CREATE TRIGGER update_categories_updated_at
BEFORE UPDATE ON categories
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_uom_updated_at ON uom;
CREATE TRIGGER update_uom_updated_at
BEFORE UPDATE ON uom
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_stores_updated_at ON stores;
CREATE TRIGGER update_stores_updated_at
BEFORE UPDATE ON stores
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_items_updated_at ON items;
CREATE TRIGGER update_items_updated_at
BEFORE UPDATE ON items
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

