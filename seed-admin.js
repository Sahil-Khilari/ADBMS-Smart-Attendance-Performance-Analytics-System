const bcrypt = require('bcrypt');
const pool   = require('./config/db');

async function seedAdmin() {
    const plainPassword = 'admin123'; // change this to whatever you want
    const hash = await bcrypt.hash(plainPassword, 10);

    await pool.query(
        `INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE password = VALUES(password), role = VALUES(role)`,
        ['System Admin', 'admin@college.edu', hash, 'admin']
    );

    console.log('✅ Admin account seeded successfully!');
    console.log('📧 Email:   admin@college.edu');
    console.log('🔑 Password:', plainPassword);
    await pool.end();
    process.exit(0);
}

seedAdmin().catch(async err => {
    console.error('❌ Error:', err);
    await pool.end();
    process.exit(1);
});