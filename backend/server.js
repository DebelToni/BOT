const express = require('express');
const session = require('express-session');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const cors = require('cors');
const multer = require('multer');
const path = require('path');

const app = express();
const port = 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session Configuration
app.use(
  session({
    secret: 'your-secret-key', // Use a strong secret in production
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false }, // Set to true if using HTTPS
  })
);

// CORS Configuration
app.use(
  cors({
    origin: 'http://localhost', // Frontend origin
    credentials: true, // Allow credentials (cookies)
  })
);

// PostgreSQL Pool Setup
const pool = new Pool({
  host: process.env.DB_HOST || 'db',
  user: process.env.DB_USER || 'yourusername',
  password: process.env.DB_PASSWORD || 'yourpassword',
  database: process.env.DB_NAME || 'yourdbname',
  port: 5432,
});

// Serve uploaded images statically
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Multer configuration for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/'); // Upload folder
  },
  filename: function (req, file, cb) {
    // Use the original file name
    cb(null, Date.now() + '-' + file.originalname);
  },
});
const upload = multer({ storage: storage });

// Routes
app.get('/', (req, res) => {
  res.send('Hello World from Backend!');
});

// Register Route
app.post('/api/register', async (req, res) => {
  const { username, password } = req.body;

  // Simple validation
  if (!username || !password) {
    return res
      .status(400)
      .json({ message: 'Username and password are required.' });
  }

  try {
    // Check if user already exists
    const userCheck = await pool.query(
      'SELECT * FROM users WHERE username = $1',
      [username]
    );
    if (userCheck.rows.length > 0) {
      return res.status(400).json({ message: 'Username already exists.' });
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Insert new user
    await pool.query(
      'INSERT INTO users (username, password) VALUES ($1, $2)',
      [username, hashedPassword]
    );

    res.status(201).json({ message: 'User registered successfully.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error.' });
  }
});

// Login Route
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;

  // Simple validation
  if (!username || !password) {
    return res
      .status(400)
      .json({ message: 'Username and password are required.' });
  }

  try {
    // Retrieve user from database
    const userResult = await pool.query(
      'SELECT * FROM users WHERE username = $1',
      [username]
    );

    if (userResult.rows.length === 0) {
      return res.status(400).json({ message: 'Invalid credentials.' });
    }

    const user = userResult.rows[0];

    // Compare hashed passwords
    const validPassword = await bcrypt.compare(password, user.password);

    if (!validPassword) {
      return res.status(400).json({ message: 'Invalid credentials.' });
    }

    // Set user session
    req.session.user = {
      id: user.id,
      username: user.username,
    };

    res.status(200).json({ message: 'Login successful.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error.' });
  }
});

// Logout Route
app.post('/api/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res
        .status(500)
        .json({ message: 'Could not log out. Please try again.' });
    }
    res.status(200).json({ message: 'Logout successful.' });
  });
});

// Session check route
app.get('/api/check-session', (req, res) => {
  if (req.session.user) {
    res.json({ user: req.session.user });
  } else {
    res.json({ user: null });
  }
});

// Recipe Upload Route
app.post('/api/upload-recipe', upload.single('image'), async (req, res) => {
  if (!req.session || !req.session.user) {
    return res.status(401).json({ message: 'Unauthorized. Please log in.' });
  }

  const { title, products, steps } = req.body;
  const imagePath = req.file ? '/uploads/' + req.file.filename : null;

  // Simple validation
  if (!title || !products || !steps) {
    return res
      .status(400)
      .json({ message: 'Title, products, and steps are required.' });
  }

  try {
    // Start a transaction
    await pool.query('BEGIN');

    // Insert new recipe
    const recipeResult = await pool.query(
      'INSERT INTO recipes (user_id, title, steps, image_path) VALUES ($1, $2, $3, $4) RETURNING id',
      [req.session.user.id, title, steps, imagePath]
    );
    const recipeId = recipeResult.rows[0].id;

    const productList = products.split(',').map(p => p.trim());
    //const productList = products.split(/[\n,]+/).map(p => p.trim()).filter(p => p);

    for (const productName of productList) {
      // Insert or ignore product
      const productResult = await pool.query(
        'INSERT INTO products (name) VALUES ($1) ON CONFLICT (name) DO NOTHING RETURNING id',
        [productName]
      );

      let productId;
      if (productResult.rows.length > 0) {
        productId = productResult.rows[0].id;
      } else {
        // Get existing product ID
        const existingProduct = await pool.query(
          'SELECT id FROM products WHERE name = $1',
          [productName]
        );
        productId = existingProduct.rows[0].id;
      }

      // Insert into recipe_products
      await pool.query(
        'INSERT INTO recipe_products (recipe_id, product_id) VALUES ($1, $2)',
        [recipeId, productId]
      );
    }

    // Commit transaction
    await pool.query('COMMIT');

    res.status(201).json({ message: 'Recipe uploaded successfully.' });
  } catch (err) {
    await pool.query('ROLLBACK');
    console.error('Error during recipe upload:', err);
    res.status(500).json({ message: 'Server error.', error: err.message });
  }
});


// Start the server
app.listen(port, '0.0.0.0', () => {
  console.log(`Server running at http://localhost:${port}/`);
});

// Get all recipes with average ratings
// Get all recipes with products
app.get('/api/recipes', async (req, res) => {
  try {
    const recipesResult = await pool.query(
      `SELECT recipes.*, users.username,
        COALESCE(AVG(ratings.rating), 0) AS average_rating,
        ARRAY_AGG(DISTINCT products.name) AS products
       FROM recipes
       INNER JOIN users ON recipes.user_id = users.id
       LEFT JOIN ratings ON recipes.id = ratings.recipe_id
       LEFT JOIN recipe_products ON recipes.id = recipe_products.recipe_id
       LEFT JOIN products ON recipe_products.product_id = products.id
       GROUP BY recipes.id, users.username
       ORDER BY recipes.created_at DESC`
    );
    res.status(200).json({ recipes: recipesResult.rows });
  } catch (err) {
    console.error('Error fetching recipes:', err);
    res.status(500).json({ message: 'Server error.', error: err.message });
  }
});



// Submit a rating
app.post('/api/recipes/:id/rate', async (req, res) => {
  if (!req.session || !req.session.user) {
    return res.status(401).json({ message: 'Unauthorized. Please log in.' });
  }

  const recipeId = req.params.id;
  const userId = req.session.user.id;
  const { rating } = req.body;

  if (!rating || rating < 1 || rating > 5) {
    return res.status(400).json({ message: 'Rating must be between 1 and 5.' });
  }

  try {
    // Upsert rating
    await pool.query(
      `INSERT INTO ratings (user_id, recipe_id, rating)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id, recipe_id)
       DO UPDATE SET rating = $3`,
      [userId, recipeId, rating]
    );
    res.status(200).json({ message: 'Rating submitted successfully.' });
  } catch (err) {
    console.error('Error submitting rating:', err);
    res.status(500).json({ message: 'Server error.', error: err.message });
  }
});

