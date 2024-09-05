// Array to hold selected items
let selectedItems = [];
let totalCost = 0;
let discountedCost = 0;
const promoCode = "VMS20";
let promoApplied = false;

document.addEventListener('DOMContentLoaded', function () {
    const addItemBtn = document.getElementById('add-item-btn');
    const totalCostDisplay = document.getElementById('total-cost');
    const discountedCostDisplay = document.getElementById('discounted-cost');
    const promoMessage = document.getElementById('promo-message');
    const applyPromoBtn = document.getElementById('apply-promo-btn');

    if (addItemBtn) {
        addItemBtn.addEventListener('click', function () {
            const clothingItemElement = document.getElementById('clothing-item');
            const clothingItem = clothingItemElement.value;
            const clothingSize = document.getElementById('clothing-size').value;
            const designUpload = document.getElementById('design-upload').files[0];
            const customLogo = document.getElementById('custom-logo-checkbox').checked;
            const additionalComments = document.getElementById('additional-comments').value;
            const price = parseFloat(clothingItemElement.options[clothingItemElement.selectedIndex].getAttribute('data-price'));

            if (!clothingItem || !clothingSize) {
                alert("Please select a clothing item and size.");
                return;
            }

            const item = {
                clothingItem: clothingItem,
                clothingSize: clothingSize,
                designUpload: designUpload ? designUpload.name : null,
                customLogo: customLogo,
                comments: additionalComments || null,
                price: price
            };

            selectedItems.push(item);
            totalCost += price;
            updateSelectedItemsList();
            totalCostDisplay.textContent = totalCost.toFixed(2);

            if (promoApplied) {
                applyPromo();
            }
        });
    }

    applyPromoBtn.addEventListener('click', function () {
        applyPromo();
    });

    function applyPromo() {
        const enteredPromoCode = document.getElementById('promo-code').value;
        if (enteredPromoCode === promoCode) {
            promoApplied = true;
            discountedCost = totalCost * 0.80; // 20% discount
            discountedCostDisplay.textContent = discountedCost.toFixed(2);
            document.querySelector('.discounted-cost').style.display = 'block';
            promoMessage.textContent = 'Promo code applied! You saved 20%.';
            promoMessage.style.color = 'green';
        } else {
            promoMessage.textContent = 'Invalid promo code.';
            promoMessage.style.color = 'red';
        }
    }
});

function updateSelectedItemsList() {
    const selectedItemsList = document.getElementById('selected-items-list');
    selectedItemsList.innerHTML = '';
    selectedItems.forEach((item, index) => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${item.clothingItem}</td>
            <td>${item.clothingSize}</td>
            <td>${item.designUpload ? item.designUpload : 'No Design'}</td>
            <td>${item.customLogo ? 'Yes' : 'No'}</td>
            <td>${item.comments ? item.comments : 'None'}</td>
            <td>$${item.price.toFixed(2)}</td>
            <td><button type="button" onclick="removeItem(${index})">Remove</button></td>
        `;
        selectedItemsList.appendChild(row);
    });
}

function removeItem(index) {
    totalCost -= selectedItems[index].price;
    selectedItems.splice(index, 1);
    document.getElementById('total-cost').textContent = totalCost.toFixed(2);
    if (promoApplied) {
        if (selectedItems.length === 0) {
            document.querySelector('.discounted-cost').style.display = 'none';
            promoApplied = false;
            document.getElementById('promo-message').textContent = '';
        } else {
            discountedCost = totalCost * 0.80;
            document.getElementById('discounted-cost').textContent = discountedCost.toFixed(2);
        }
    }
    updateSelectedItemsList();
}

document.getElementById('submit-all-btn').addEventListener('click', function () {
    const firstName = document.getElementById('first-name').value;
    const lastName = document.getElementById('last-name').value;
    const contactInfo = document.getElementById('contact-info').value;

    if (!firstName || !lastName || !contactInfo) {
        alert('Please provide your full name and contact information.');
        return;
    }

    if (selectedItems.length === 0) {
        alert("No items selected.");
        return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    doc.setFontSize(22);
    doc.text('INVOICE', 105, 20, null, null, 'center');
    doc.setFontSize(12);
    doc.text('Vision Make Studio', 105, 28, null, null, 'center');
    doc.text('www.visionmakestudio.com', 105, 34, null, null, 'center');

    doc.setFontSize(12);
    doc.text(`Customer: ${firstName} ${lastName}`, 10, 50);
    doc.text(`Contact Info: ${contactInfo}`, 10, 58);

    doc.line(10, 65, 200, 65);

    doc.setFontSize(12);
    doc.text('Item', 10, 75);
    doc.text('Size', 60, 75);
    doc.text('Price', 110, 75);
    doc.text('Custom Logo', 140, 75);
    doc.text('Comments', 170, 75);
    doc.line(10, 78, 200, 78);

    let yPosition = 85;
    selectedItems.forEach((item, index) => {
        doc.text(`${item.clothingItem}`, 10, yPosition);
        doc.text(`${item.clothingSize}`, 60, yPosition);
        doc.text(`$${item.price.toFixed(2)}`, 110, yPosition);
        doc.text(`${item.customLogo ? 'Yes' : 'No'}`, 140, yPosition);
        doc.text(`${item.comments ? item.comments : 'None'}`, 170, yPosition);
        yPosition += 10;
    });

    doc.line(10, yPosition, 200, yPosition);

    yPosition += 10;
    doc.setFontSize(14);
    doc.text(`Total: $${totalCost.toFixed(2)}`, 10, yPosition);

    if (promoApplied) {
        yPosition += 10;
        doc.text(`Discounted Total: $${discountedCost.toFixed(2)}`, 10, yPosition);
    }

    yPosition += 20;
    doc.setFontSize(10);
    doc.text('Thank you for your business!', 105, yPosition, null, null, 'center');
    doc.text('If you have any questions, feel free to contact us at info@visionmakestudio.com', 105, yPosition + 6, null, null, 'center');

    doc.save('invoice.pdf');
});
