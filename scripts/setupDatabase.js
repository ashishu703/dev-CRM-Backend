require('dotenv').config();
const { query } = require('../config/database');
const bcrypt = require('bcryptjs');
const logger = require('../utils/logger');

const setupDatabase = async () => {
  try {
    logger.info('Starting database setup...');

    await query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        username VARCHAR(30) UNIQUE NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        role VARCHAR(20) DEFAULT 'user' CHECK (role IN ('user', 'admin', 'moderator')),
        bio TEXT,
        is_active BOOLEAN DEFAULT true,
        email_verified BOOLEAN DEFAULT false,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS review_criteria (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(100) NOT NULL,
        description TEXT,
        weight DECIMAL(3,2) DEFAULT 1.00,
        category VARCHAR(50) NOT NULL,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS reviews (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        title VARCHAR(200) NOT NULL,
        content TEXT NOT NULL,
        category VARCHAR(50) NOT NULL,
        priority VARCHAR(20) DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
        status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
        overall_score DECIMAL(3,2),
        file_path VARCHAR(500),
        file_name VARCHAR(255),
        file_size INTEGER,
        processing_time INTEGER,
        feedback TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS review_scores (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        review_id UUID NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
        criteria_id UUID NOT NULL REFERENCES review_criteria(id) ON DELETE CASCADE,
        score DECIMAL(3,2) NOT NULL,
        feedback TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(review_id, criteria_id)
      )
    `);

    await query('CREATE INDEX IF NOT EXISTS idx_reviews_user_id ON reviews(user_id)');
    await query('CREATE INDEX IF NOT EXISTS idx_reviews_status ON reviews(status)');
    await query('CREATE INDEX IF NOT EXISTS idx_reviews_category ON reviews(category)');
    await query('CREATE INDEX IF NOT EXISTS idx_reviews_created_at ON reviews(created_at)');
    await query('CREATE INDEX IF NOT EXISTS idx_review_scores_review_id ON review_scores(review_id)');
    await query('CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)');
    await query('CREATE INDEX IF NOT EXISTS idx_users_username ON users(username)');

    const criteriaData = [
      {
        name: 'Grammar and Spelling',
        description: 'Checks for grammatical errors, spelling mistakes, and punctuation',
        weight: 0.25,
        category: 'academic'
      },
      {
        name: 'Content Quality',
        description: 'Evaluates the overall quality and depth of the content',
        weight: 0.30,
        category: 'academic'
      },
      {
        name: 'Structure and Organization',
        description: 'Assesses the logical flow and organization of ideas',
        weight: 0.20,
        category: 'academic'
      },
      {
        name: 'Originality',
        description: 'Checks for plagiarism and ensures original content',
        weight: 0.15,
        category: 'academic'
      },
      {
        name: 'Technical Accuracy',
        description: 'Verifies technical facts and references',
        weight: 0.10,
        category: 'academic'
      },
      {
        name: 'Business Logic',
        description: 'Evaluates business reasoning and strategic thinking',
        weight: 0.35,
        category: 'business'
      },
      {
        name: 'Market Analysis',
        description: 'Assesses market understanding and competitive analysis',
        weight: 0.25,
        category: 'business'
      },
      {
        name: 'Financial Viability',
        description: 'Evaluates financial projections and feasibility',
        weight: 0.20,
        category: 'business'
      },
      {
        name: 'Risk Assessment',
        description: 'Identifies and evaluates potential risks',
        weight: 0.20,
        category: 'business'
      },
      {
        name: 'Creativity',
        description: 'Assesses originality and creative thinking',
        weight: 0.40,
        category: 'creative'
      },
      {
        name: 'Artistic Merit',
        description: 'Evaluates artistic quality and aesthetic appeal',
        weight: 0.30,
        category: 'creative'
      },
      {
        name: 'Technical Skill',
        description: 'Assesses technical execution and craftsmanship',
        weight: 0.30,
        category: 'creative'
      },
      {
        name: 'Code Quality',
        description: 'Evaluates code structure, readability, and best practices',
        weight: 0.35,
        category: 'technical'
      },
      {
        name: 'Performance',
        description: 'Assesses efficiency and optimization',
        weight: 0.25,
        category: 'technical'
      },
      {
        name: 'Security',
        description: 'Evaluates security practices and vulnerability assessment',
        weight: 0.20,
        category: 'technical'
      },
      {
        name: 'Documentation',
        description: 'Assesses code documentation and comments',
        weight: 0.20,
        category: 'technical'
      }
    ];

    for (const criteria of criteriaData) {
      await query(`
        INSERT INTO review_criteria (name, description, weight, category)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT DO NOTHING
      `, [criteria.name, criteria.description, criteria.weight, criteria.category]);
    }

    const adminPassword = await bcrypt.hash('Admin123!', 12);
    await query(`
      INSERT INTO users (username, email, password_hash, role, email_verified)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (email) DO NOTHING
    `, ['admin', 'admin@automaticreview.com', adminPassword, 'admin', true]);

    await query(`
      CREATE OR REPLACE FUNCTION update_updated_at_column()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = CURRENT_TIMESTAMP;
        RETURN NEW;
      END;
      $$ language 'plpgsql';
    `);

    await query(`
      DROP TRIGGER IF EXISTS update_users_updated_at ON users;
      CREATE TRIGGER update_users_updated_at
        BEFORE UPDATE ON users
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();
    `);

    await query(`
      DROP TRIGGER IF EXISTS update_reviews_updated_at ON reviews;
      CREATE TRIGGER update_reviews_updated_at
        BEFORE UPDATE ON reviews
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();
    `);

    logger.info('Database setup completed successfully!');
    logger.info('Default admin user created:');
    logger.info('Email: admin@automaticreview.com');
    logger.info('Password: Admin123!');

  } catch (error) {
    logger.error('Database setup failed:', error);
    process.exit(1);
  }
};

if (require.main === module) {
  setupDatabase();
}

module.exports = setupDatabase; 