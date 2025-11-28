# Products and Prices Guide

## How to Access Your Products and Prices

Your products and prices are stored in the app's configuration and can be accessed through the Settings modal.

### Accessing Products and Prices in the App:

1. **Open Settings**: Click the gear icon (⚙️) in the navigation sidebar
2. **Navigate to Products Tab**: Click on the "Products" tab in the settings modal
3. **View Products**: You'll see all your products listed with their details
4. **Navigate to Pricing Tab**: Click on the "Pricing" tab to see all product prices

### Product Structure:

Each product contains:
- **ID**: Unique identifier
- **Name**: Product name
- **Category**: Product category
- **Short Description**: Brief description
- **Full Description**: Detailed description (optional)
- **Tags**: Keywords for search
- **Specifications**: Additional product details (weight, packaging, etc.)
- **Image URL**: Product image link (optional)
- **Active Status**: Whether the product is active

### Price Structure:

Each price entry contains:
- **Product ID**: Links to the product
- **Product Name**: Product name (for quick reference)
- **Unit of Measure**: kg, piece, box, packet, MT, etc.
- **Base Price**: Standard price
- **Wholesale Price**: Bulk/wholesale pricing (optional)
- **Retail Price**: Retail pricing (optional)
- **Special Customer Price**: Special pricing (optional)
- **Currency**: USD, EUR, INR, etc.
- **Effective Date**: When the price became effective
- **Notes**: Additional pricing notes (optional)
- **Active Status**: Whether the price is active

### Exporting Products and Prices:

You can export your products and prices using the script provided:

```bash
node scripts/get-products-prices.js
```

This will:
1. Display all products and prices in the console
2. Create a JSON export file at: `C:\Users\Asus\AppData\Roaming\shreenathji-app\products-prices-export.json`

### Current Status:

Based on the last check, you currently have:
- **Total Products**: 0
- **Total Prices**: 0

### Adding Products and Prices:

1. **Add Products**:
   - Go to Settings → Products tab
   - Click "Add Product" button
   - Fill in the product details
   - Save the product

2. **Add Prices**:
   - Go to Settings → Pricing tab
   - Click "Add Price" button
   - Select a product
   - Enter pricing information
   - Save the price

3. **Import from File**:
   - Use the "Import" button in Products or Pricing tabs
   - Upload an Excel or CSV file with your product/price data

### Data Storage Location:

Your products and prices are stored in:
- **Windows**: `C:\Users\Asus\AppData\Roaming\shreenathji-app\config.json`
- The data is stored under keys: `products_catalog` and `product_prices`

### Example Product:

```json
{
  "id": "product_1234567890_abc123",
  "name": "Corn Poha 500g",
  "category": "Food Products",
  "shortDescription": "Premium quality corn poha",
  "fullDescription": "High-quality corn poha, 500g packaging",
  "tags": ["corn", "poha", "food", "snacks"],
  "specifications": {
    "weight": "500g",
    "packaging": "Box",
    "quantity": "12 pcs"
  },
  "active": true,
  "createdAt": 1234567890000,
  "updatedAt": 1234567890000
}
```

### Example Price:

```json
{
  "id": "price_1234567890_xyz789",
  "productId": "product_1234567890_abc123",
  "productName": "Corn Poha 500g",
  "unitOfMeasure": "piece",
  "basePrice": 7.52,
  "wholesalePrice": 6.50,
  "retailPrice": 8.00,
  "currency": "USD",
  "effectiveDate": 1234567890000,
  "lastUpdated": 1234567890000,
  "active": true
}
```

