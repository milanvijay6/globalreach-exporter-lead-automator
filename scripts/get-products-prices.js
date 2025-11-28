const fs = require('fs');
const path = require('path');
const { app } = require('electron');

// Get the user data path
const userDataPath = app ? app.getPath('userData') : path.join(require('os').homedir(), 'AppData', 'Roaming', 'shreenathji-app');
const configPath = path.join(userDataPath, 'config.json');

console.log('Looking for config at:', configPath);

if (!fs.existsSync(configPath)) {
  console.log('Config file not found. The app may not have been run yet, or no products/prices have been created.');
  process.exit(0);
}

try {
  const configData = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  
  // Get products
  const productsData = configData.products_catalog;
  const products = typeof productsData === 'string' ? JSON.parse(productsData) : productsData;
  
  // Get prices
  const pricesData = configData.product_prices;
  const prices = typeof pricesData === 'string' ? JSON.parse(pricesData) : pricesData;
  
  console.log('\n=== PRODUCTS CATALOG ===\n');
  if (!products || products.length === 0) {
    console.log('No products found.');
  } else {
    console.log(`Total Products: ${products.length}\n`);
    products.forEach((product, index) => {
      console.log(`${index + 1}. ${product.name}`);
      console.log(`   ID: ${product.id}`);
      console.log(`   Category: ${product.category}`);
      console.log(`   Description: ${product.shortDescription || 'N/A'}`);
      console.log(`   Tags: ${product.tags?.join(', ') || 'None'}`);
      console.log(`   Active: ${product.active ? 'Yes' : 'No'}`);
      if (product.specifications && Object.keys(product.specifications).length > 0) {
        console.log(`   Specifications: ${JSON.stringify(product.specifications)}`);
      }
      console.log('');
    });
  }
  
  console.log('\n=== PRODUCT PRICING ===\n');
  if (!prices || prices.length === 0) {
    console.log('No prices found.');
  } else {
    console.log(`Total Prices: ${prices.length}\n`);
    prices.forEach((price, index) => {
      console.log(`${index + 1}. ${price.productName || 'Unknown Product'}`);
      console.log(`   Product ID: ${price.productId}`);
      console.log(`   Unit: ${price.unitOfMeasure}`);
      console.log(`   Currency: ${price.currency || 'USD'}`);
      console.log(`   Base Price: ${price.basePrice || 0} ${price.currency || 'USD'}`);
      if (price.wholesalePrice) {
        console.log(`   Wholesale Price: ${price.wholesalePrice} ${price.currency || 'USD'}`);
      }
      if (price.retailPrice) {
        console.log(`   Retail Price: ${price.retailPrice} ${price.currency || 'USD'}`);
      }
      if (price.specialCustomerPrice) {
        console.log(`   Special Price: ${price.specialCustomerPrice} ${price.currency || 'USD'}`);
      }
      console.log(`   Active: ${price.active ? 'Yes' : 'No'}`);
      if (price.notes) {
        console.log(`   Notes: ${price.notes}`);
      }
      console.log(`   Effective Date: ${new Date(price.effectiveDate).toLocaleString()}`);
      console.log('');
    });
  }
  
  // Create a summary report
  console.log('\n=== SUMMARY REPORT ===\n');
  console.log(`Total Products: ${products?.length || 0}`);
  console.log(`Total Prices: ${prices?.length || 0}`);
  console.log(`Active Products: ${products?.filter(p => p.active).length || 0}`);
  console.log(`Active Prices: ${prices?.filter(p => p.active).length || 0}`);
  
  // Export to JSON file
  const exportPath = path.join(userDataPath, 'products-prices-export.json');
  const exportData = {
    exportedAt: new Date().toISOString(),
    products: products || [],
    prices: prices || [],
  };
  fs.writeFileSync(exportPath, JSON.stringify(exportData, null, 2));
  console.log(`\n✅ Data exported to: ${exportPath}`);
  
} catch (error) {
  console.error('Error reading config:', error.message);
  process.exit(1);
}

