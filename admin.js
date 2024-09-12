const uploadForm = document.getElementById('upload-item-form');
const imageUrlsContainer = document.getElementById('image-urls-container');
const addImageButton = document.getElementById('add-image-button');

let items = JSON.parse(localStorage.getItem('items')) || [];

// Add another image URL and color field when "Add Another Image" is clicked
addImageButton.addEventListener('click', () => {
    const newImageField = document.createElement('div');
    newImageField.classList.add('image-url-field');
    newImageField.innerHTML = `
        <input type="text" class="input-field image-url-input" placeholder="Enter image URL" required>
        <input type="text" class="input-field image-color-input" placeholder="Enter color" required>
        <button type="button" class="delete-image-button">Delete</button>
    `;
    imageUrlsContainer.appendChild(newImageField);

    // Add event listener to the delete button for removing the image field
    newImageField.querySelector('.delete-image-button').addEventListener('click', function() {
        imageUrlsContainer.removeChild(newImageField);
    });
});

uploadForm.addEventListener('submit', (e) => {
    e.preventDefault();

    const name = document.getElementById('item-name').value;
    const price = document.getElementById('item-price').value;
    const sizes = document.getElementById('item-sizes').value;

    // Get all image URLs and colors
    const imageInputs = document.querySelectorAll('.image-url-input');
    const colorInputs = document.querySelectorAll('.image-color-input');
    const images = Array.from(imageInputs).map((input, index) => ({
        url: input.value,
        color: colorInputs[index].value
    }));

    const newItem = {
        name: name,
        price: parseFloat(price),
        sizes: sizes,
        images: images // Store images and colors
    };

    items.push(newItem);
    localStorage.setItem('items', JSON.stringify(items)); // Save to localStorage

    alert('Item added successfully!');
    uploadForm.reset(); // Reset the form after submission
    imageUrlsContainer.innerHTML = ''; // Clear any additional image fields
    displayItemsInAdmin(); // Refresh the existing items list
});

// Display existing items in the admin page
function displayItemsInAdmin() {
    const existingItemsContainer = document.getElementById('existing-items');
    existingItemsContainer.innerHTML = ''; // Clear previous items

    items.forEach((item, index) => {
        const itemDiv = document.createElement('div');
        itemDiv.classList.add('item-card-admin');

        // Display images and colors
        const imagesHtml = item.images.map(image => `
            <div>
                <img src="${image.url}" alt="${item.name}" width="100">
                <p>Color: ${image.color}</p>
            </div>
        `).join('');

        itemDiv.innerHTML = `
            <p><strong>${item.name}</strong> - $${item.price}</p>
            <p>Sizes: ${item.sizes}</p>
            <div>${imagesHtml}</div>
            <button onclick="editItem(${index})" class="edit-button">Edit</button>
            <button onclick="deleteItem(${index})" class="delete-button">Delete</button>
        `;
        existingItemsContainer.appendChild(itemDiv);
    });
}

// Function to delete an item
function deleteItem(index) {
    items.splice(index, 1); // Remove the item from the array
    localStorage.setItem('items', JSON.stringify(items)); // Update localStorage
    displayItemsInAdmin(); // Refresh the list
    alert('Item deleted successfully!');
}

// Function to edit an item
function editItem(index) {
    const item = items[index];

    // Pre-fill the form with the existing item details
    document.getElementById('item-name').value = item.name;
    document.getElementById('item-price').value = item.price;
    document.getElementById('item-sizes').value = item.sizes;

    // Clear current image URLs and add the existing ones to the form
    imageUrlsContainer.innerHTML = ''; // Clear current inputs

    item.images.forEach(image => {
        const newImageField = document.createElement('div');
        newImageField.classList.add('image-url-field');
        newImageField.innerHTML = `
            <input type="text" class="input-field image-url-input" value="${image.url}" placeholder="Enter image URL" required>
            <input type="text" class="input-field image-color-input" value="${image.color}" placeholder="Enter color" required>
            <button type="button" class="delete-image-button">Delete</button>
        `;
        imageUrlsContainer.appendChild(newImageField);

        // Add delete functionality for image fields
        newImageField.querySelector('.delete-image-button').addEventListener('click', function() {
            imageUrlsContainer.removeChild(newImageField);
        });
    });

    // Update the form submission to handle editing
    uploadForm.onsubmit = function (e) {
        e.preventDefault();

        const updatedItem = {
            name: document.getElementById('item-name').value,
            price: parseFloat(document.getElementById('item-price').value),
            sizes: document.getElementById('item-sizes').value,
            images: Array.from(document.querySelectorAll('.image-url-input')).map((input, idx) => ({
                url: input.value,
                color: document.querySelectorAll('.image-color-input')[idx].value
            }))
        };

        items[index] = updatedItem; // Update the item in the array
        localStorage.setItem('items', JSON.stringify(items)); // Save to localStorage
        alert('Item updated successfully!');
        uploadForm.reset();
        imageUrlsContainer.innerHTML = ''; // Clear image inputs
        displayItemsInAdmin(); // Refresh the list
    };
}

// Load items on page load for admin page
window.onload = function() {
    displayItemsInAdmin();
}
