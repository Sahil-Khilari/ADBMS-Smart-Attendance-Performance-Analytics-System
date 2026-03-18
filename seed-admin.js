const bcrypt = require('bcrypt');
const pool   = require('./config/db');

async function seedAdmin() {
    const plainPassword = 'admin123'; // change this to whatever you want
    const hash = await bcrypt.hash(plainPassword, 10);

    await pool.query(
        `UPDATE users SET password = ? WHERE email = ?`,
        [hash, 'admin@college.edu']
    );

    console.log('✅ Admin password updated successfully!');
    console.log('📧 Email:   admin@college.edu');
    console.log('🔑 Password:', plainPassword);
    process.exit(0);
}

seedAdmin().catch(err => {
    console.error('❌ Error:', err);
    process.exit(1);
});