const bcrypt = require('bcryptjs');
const password = 'password123';
const pepper = 'change_me_to_another_long_random_string';
bcrypt.hash(password + pepper, 10).then(h => console.log('HASH:', h));