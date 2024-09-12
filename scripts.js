// Initialize items from localStorage
let items = JSON.parse(localStorage.getItem('items')) || [];

const itemsGrid = document.getElementById('items-grid');

// Load items and display them on the main page
function displayItemsOnMainPage() {
    itemsGrid.innerHTML = ''; // Clear previous items

    items.forEach((item, index) => {
        const itemCard = document.createElement('div');
        itemCard.classList.add('item-card');

        // Handle sizes
        const sizes = item.sizes.split(',').map(size => `<option value="${size.trim()}">${size.trim()}</option>`).join('');
        
        // Handle colors and associate them with images
        const colors = item.images.map(image => `<option value="${image.color}">${image.color}</option>`).join('');
        
        // Display the first image by default
        let firstImage = item.images.length > 0 ? item.images[0].url : 'placeholder-image.jpg';

        // Create HTML for item card
        itemCard.innerHTML = `
            <img src="${firstImage}" alt="${item.name}" class="item-image" data-index="${index}">
            <h3>${item.name}</h3>
            <p class="price">$${item.price}</p>
            <label for="size-select">Select Size:</label>
            <select class="size-select">${sizes}</select>
            <label for="color-select">Select Color:</label>
            <select class="color-select" data-index="${index}">${colors}</select>
        `;
        itemsGrid.appendChild(itemCard);
    });

    // Add event listeners for color selection change
    document.querySelectorAll('.color-select').forEach(select => {
        select.addEventListener('change', changeImageBasedOnColor);
    });
}

// Function to change the image when the color is selected
function changeImageBasedOnColor(event) {
    const itemIndex = event.target.getAttribute('data-index');
    const selectedColor = event.target.value;
    const selectedItem = items[itemIndex];

    // Find the image that corresponds to the selected color
    const matchingImage = selectedItem.images.find(image => image.color === selectedColor).url;

    // Update the image on the page
    const itemImage = document.querySelector(`.item-image[data-index="${itemIndex}"]`);
    itemImage.src = matchingImage;
}

// Handle Admin button click with password protection
document.getElementById('admin-button').addEventListener('click', () => {
    const password = prompt("Enter Admin Password:");
    if (password === "admin123") { // Replace with your desired password
        window.location.href = 'admin.html'; // Redirect to the admin page
    } else {
        alert("Incorrect Password!");
    }
});

// Initialize and load items when the page is ready
window.onload = function() {
    displayItemsOnMainPage();
};
