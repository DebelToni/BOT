document.addEventListener('DOMContentLoaded', () => {
    // Check if user is logged in
    (async () => {
      try {
        const response = await fetch('/api/check-session', {
          credentials: 'include'
        });
        const data = await response.json();
        if (data.user) {
          // User is logged in
          if (document.getElementById('logoutButton')) {
            document.getElementById('logoutButton').style.display = 'inline';
            document.getElementById('logoutButton').addEventListener('click', logout);
          }
        } else {
          // User is not logged in
          if (document.getElementById('logoutButton')) {
            document.getElementById('logoutButton').style.display = 'none';
          }
          if (window.location.pathname === '/recipe.html') {
            window.location.href = 'login.html';
          }
        }
      } catch (error) {
        console.error('Error:', error);
      }
    })();
  
    // Registration form submission
    const registerForm = document.getElementById('registerForm');
    if (registerForm) {
      registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;
  
        try {
          const response = await fetch('/api/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password }),
            credentials: 'include'
          });
  
          const data = await response.json();
          document.getElementById('message').innerText = data.message;
          if (response.status === 201) {
            window.location.href = 'login.html';
          }
        } catch (error) {
          console.error('Error:', error);
          document.getElementById('message').innerText = 'An error occurred.';
        }
      });
    }
  
    // Login form submission
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
      loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;
  
        try {
          const response = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password }),
            credentials: 'include'
          });
  
          const data = await response.json();
          document.getElementById('message').innerText = data.message;
  
          if (response.status === 200) {
            window.location.href = 'recipe.html';
          }
        } catch (error) {
          console.error('Error:', error);
          document.getElementById('message').innerText = 'An error occurred.';
        }
      });
    }
  
    // Recipe form submission
    const recipeForm = document.getElementById('recipeForm');
    if (recipeForm) {
      recipeForm.addEventListener('submit', async (e) => {
        e.preventDefault();
  
        const formData = new FormData(recipeForm);
  
        try {
          const response = await fetch('/api/upload-recipe', {
            method: 'POST',
            body: formData,
            credentials: 'include'
          });
  
          const data = await response.json();
          document.getElementById('message').innerText = data.message;
  
          if (response.status === 201) {
            // Clear form
            recipeForm.reset();
          }
        } catch (error) {
          console.error('Error:', error);
          document.getElementById('message').innerText = 'An error occurred.';
        }
      });
    }
  
    // Logout function
    async function logout() {
      try {
        const response = await fetch('/api/logout', {
          method: 'POST',
          credentials: 'include'
        });
        await response.json();
        window.location.href = 'index.html';
      } catch (error) {
        console.error('Error:', error);
      }
    }

    if (window.location.pathname === '/recipes.html') {
      fetchRecipes();
    }

    // Function to fetch recipes
    async function fetchRecipes() {
      try {
        const response = await fetch('/api/recipes', {
          method: 'GET',
          credentials: 'include'
        });
        const data = await response.json();
        if (response.status === 200) {
          displayRecipes(data.recipes);
        } else {
          document.getElementById('recipesContainer').innerText = data.message;
        }
      } catch (error) {
        console.error('Error fetching recipes:', error);
        document.getElementById('recipesContainer').innerText = 'An error occurred while fetching recipes.';
      }
    }

    function displayRecipes(recipes) {
      const container = document.getElementById('recipesContainer');
      container.innerHTML = ''; // Clear any existing content
    
      recipes.forEach(recipe => {
        const card = document.createElement('div');
        card.className = 'recipe-card';
    
        const title = document.createElement('h2');
        title.innerText = recipe.title;
        card.appendChild(title);
    
        const author = document.createElement('p');
        author.className = 'author';
        author.innerText = `Uploaded by: ${recipe.username}`;
        card.appendChild(author);
    
        if (recipe.image_path) {
          const image = document.createElement('img');
          image.src = recipe.image_path;
          card.appendChild(image);
        }
    
        const averageRating = document.createElement('p');
        averageRating.innerText = `Average Rating: ${parseFloat(recipe.average_rating).toFixed(1)} / 5`;
        card.appendChild(averageRating);
    
        const ratingForm = document.createElement('form');
        ratingForm.className = 'rating-form';
    
        const ratingLabel = document.createElement('label');
        ratingLabel.innerText = 'Your Rating:';
        ratingForm.appendChild(ratingLabel);
    
        const ratingSelect = document.createElement('select');
        ratingSelect.name = 'rating';
        for (let i = 1; i <= 5; i++) {
          const option = document.createElement('option');
          option.value = i;
          option.innerText = i;
          ratingSelect.appendChild(option);
        }
        ratingForm.appendChild(ratingSelect);
    
        const ratingButton = document.createElement('button');
        ratingButton.type = 'submit';
        ratingButton.innerText = 'Submit Rating';
        ratingForm.appendChild(ratingButton);
    
        ratingForm.addEventListener('submit', (e) => {
          e.preventDefault();
          submitRating(recipe.id, ratingSelect.value);
        });
    
        card.appendChild(ratingForm);
    
        const products = document.createElement('div');
        products.className = 'products';
        const productsTitle = document.createElement('div');
        productsTitle.className = 'section-title';
        productsTitle.innerText = 'Products:';
        products.appendChild(productsTitle);
        
        const productsList = document.createElement('ul');
        recipe.products.forEach(product => {
          const listItem = document.createElement('li');
          listItem.innerText = product;
          productsList.appendChild(listItem);
        });
        products.appendChild(productsList);

        card.appendChild(products);
    
        const steps = document.createElement('div');
        steps.className = 'steps';
        const stepsTitle = document.createElement('div');
        stepsTitle.className = 'section-title';
        stepsTitle.innerText = 'Steps:';
        steps.appendChild(stepsTitle);
        const stepsList = document.createElement('p');
        stepsList.innerText = recipe.steps;
        steps.appendChild(stepsList);
        card.appendChild(steps);
    
        container.appendChild(card);
      });
    }
    
    // Function to submit a rating
    async function submitRating(recipeId, rating) {
      try {
        const response = await fetch(`/api/recipes/${recipeId}/rate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rating }),
          credentials: 'include'
        });
        const data = await response.json();
        alert(data.message);
        // Refresh the recipes list to update average ratings
        fetchRecipes();
      } catch (error) {
        console.error('Error submitting rating:', error);
        alert('An error occurred while submitting your rating.');
      }
    }
    


  });
  